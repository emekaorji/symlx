import fs from "node:fs";
import path from "node:path";

import type { LinkRecord, SessionRecord } from "../core/types";

// Lightweight JSON reader used for session metadata files.
function readJsonFile<T>(filePath: string): T {
  const raw = fs.readFileSync(filePath, "utf8");
  return JSON.parse(raw) as T;
}

// Checks whether a PID from a previous session is still alive.
function isProcessAlive(pid: number): boolean {
  if (!Number.isInteger(pid) || pid <= 0) {
    return false;
  }

  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    return code !== "ESRCH";
  }
}

// Session files are best-effort state; deletion failure should not fail the command.
function deleteSessionFile(filePath: string): void {
  try {
    fs.unlinkSync(filePath);
  } catch {
    // Best-effort cleanup.
  }
}

// Invalid/corrupted session files are ignored and later removed.
function loadSession(filePath: string): SessionRecord | undefined {
  try {
    return readJsonFile<SessionRecord>(filePath);
  } catch {
    return undefined;
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
      const absoluteLinkedTo = path.resolve(path.dirname(link.linkPath), linkedTo);
      if (absoluteLinkedTo === path.resolve(link.target)) {
        fs.unlinkSync(link.linkPath);
      }
    } catch {
      // Best-effort cleanup.
    }
  }
}

// Ensures runtime directories exist before linking/saving sessions.
export function ensureSymlxDirectories(binDir: string, sessionDir: string): void {
  fs.mkdirSync(binDir, { recursive: true });
  fs.mkdirSync(sessionDir, { recursive: true });
}

// Reaps stale sessions left behind by crashes/kill -9 and removes their symlinks.
export function cleanupStaleSessions(sessionDir: string): void {
  if (!fs.existsSync(sessionDir)) {
    return;
  }

  for (const entry of fs.readdirSync(sessionDir)) {
    if (!entry.endsWith(".json")) {
      continue;
    }

    const filePath = path.join(sessionDir, entry);
    const record = loadSession(filePath);
    if (!record) {
      deleteSessionFile(filePath);
      continue;
    }

    if (!isProcessAlive(record.pid)) {
      cleanupLinks(record.links);
      deleteSessionFile(filePath);
    }
  }
}

// Persists currently linked commands so future runs can clean stale state.
export function persistSession(sessionPath: string, record: SessionRecord): void {
  fs.writeFileSync(sessionPath, `${JSON.stringify(record, null, 2)}\n`, "utf8");
}

// Produces unique session file names to avoid collisions across concurrent runs.
export function createSessionFilePath(sessionDir: string): string {
  const unique = `${Date.now()}-${process.pid}-${Math.random().toString(36).slice(2, 8)}`;
  return path.join(sessionDir, `${unique}.json`);
}

// Cleanup for the active process/session.
export function cleanupSession(sessionPath: string, links: LinkRecord[]): void {
  cleanupLinks(links);
  deleteSessionFile(sessionPath);
}
