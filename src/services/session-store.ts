import fs from "node:fs";
import path from "node:path";

import type { LinkRecord, SessionRecord } from "../core/types";

function readJsonFile<T>(filePath: string): T {
  const raw = fs.readFileSync(filePath, "utf8");
  return JSON.parse(raw) as T;
}

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

function deleteSessionFile(filePath: string): void {
  try {
    fs.unlinkSync(filePath);
  } catch {
    // Best-effort cleanup.
  }
}

function loadSession(filePath: string): SessionRecord | undefined {
  try {
    return readJsonFile<SessionRecord>(filePath);
  } catch {
    return undefined;
  }
}

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

export function ensureCxDirectories(binDir: string, sessionDir: string): void {
  fs.mkdirSync(binDir, { recursive: true });
  fs.mkdirSync(sessionDir, { recursive: true });
}

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

export function persistSession(sessionPath: string, record: SessionRecord): void {
  fs.writeFileSync(sessionPath, `${JSON.stringify(record, null, 2)}\n`, "utf8");
}

export function createSessionFilePath(sessionDir: string): string {
  const unique = `${Date.now()}-${process.pid}-${Math.random().toString(36).slice(2, 8)}`;
  return path.join(sessionDir, `${unique}.json`);
}

export function cleanupSession(sessionPath: string, links: LinkRecord[]): void {
  cleanupLinks(links);
  deleteSessionFile(sessionPath);
}
