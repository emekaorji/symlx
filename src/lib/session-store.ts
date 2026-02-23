import fs from 'node:fs';
import path from 'node:path';

import type { LinkRecord, SessionRecord } from './types';
import * as log from '../ui/logger';
import { deleteFile, loadJSONFile } from './utils';

// Checks whether a PID from a previous session is still alive.
function isProcessAlive(pid: number): boolean {
  // PIDs are always positive integer typically less the 2^15
  if (!Number.isInteger(pid) || pid <= 0) {
    return false;
  }

  try {
    // Check on the process without killing it (signal 0)
    process.kill(pid, 0);
    return true;
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    // If the error code is not ESRCH, then it means the process does not exist
    // If it's EPERM, then it's running, you simply don't have permission to signal it (fair enough)
    return code !== 'ESRCH';
  }
}

// Removes only symlinks that still point to the exact targets we created.
// This avoids deleting user-managed commands with the same name.
function cleanupLinks(links: LinkRecord[]): void {
  for (const link of links) {
    try {
      const stats = fs.lstatSync(link.linkPath);
      if (!stats.isSymbolicLink()) {
        continue;
      }

      const linkedTo = fs.readlinkSync(link.linkPath);
      const absoluteLinkedTo = path.resolve(
        path.dirname(link.linkPath),
        linkedTo,
      );
      if (absoluteLinkedTo === path.resolve(link.target)) {
        fs.unlinkSync(link.linkPath);
      }
    } catch {
      // Best-effort cleanup.
    }
  }
}

// Ensures runtime directories exist before linking/saving sessions.
export function ensureSymlxDirectories(
  binDir: string,
  sessionDir: string,
): void {
  fs.mkdirSync(binDir, { recursive: true });
  fs.mkdirSync(sessionDir, { recursive: true });
}

// Reaps stale sessions left behind by crashes/kill -9 and removes their symlinks.
export function cleanupStaleSessions(sessionDir: string): void {
  // If the directory does not exist, return early
  if (!fs.existsSync(sessionDir)) {
    return;
  }

  let cleanUpCount = 0;

  // Loop through the files within the session
  for (const entry of fs.readdirSync(sessionDir)) {
    const filePath = path.join(sessionDir, entry);

    // Delete any files that are not .json, session files can only be JSON
    if (!entry.endsWith('.json')) {
      deleteFile(filePath);
      continue;
    }

    // If the expected file structure has been corrupted, delete the file
    const record = loadJSONFile<SessionRecord>(filePath);
    if (!record) {
      deleteFile(filePath);
      continue;
    }

    // If process is dead, unlink the command from the bin and delete the session file
    if (!isProcessAlive(record.pid)) {
      cleanupLinks(record.links);
      deleteFile(filePath);
      cleanUpCount++;
    }
  }

  if (cleanUpCount > 0) {
    log.info(
      `cleaned up ${cleanUpCount} expired session${cleanUpCount > 1 ? 's' : ''}`,
    );
  }
}

// Persists currently linked commands so future runs can clean stale state.
export function persistSession(
  sessionPath: string,
  record: SessionRecord,
): void {
  fs.writeFileSync(sessionPath, `${JSON.stringify(record, null, 2)}\n`, 'utf8');
}

// Produces unique session file names to avoid collisions across concurrent runs.
export function createSessionFilePath(sessionDir: string): string {
  const unique = `${Date.now()}-${process.pid}-${Math.random().toString(36).slice(2, 8)}`;
  return path.join(sessionDir, `${unique}.json`);
}

// Cleanup for the active process/session.
export function cleanupSession(sessionPath: string, links: LinkRecord[]): void {
  cleanupLinks(links);
  deleteFile(sessionPath);
}
