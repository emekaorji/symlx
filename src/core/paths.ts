import os from "node:os";
import path from "node:path";

import type { SymlxPaths } from "./types";

// Central place for runtime paths so every command/service resolves locations consistently.
export function getSymlxPaths(customBinDir?: string): SymlxPaths {
  // symlx keeps mutable runtime state under the user's home directory.
  const rootDir = path.join(os.homedir(), ".symlx");
  // Commands are linked here unless the caller overrides with --bin-dir.
  const binDir = customBinDir ? path.resolve(customBinDir) : path.join(rootDir, "bin");
  // Session files live separately from bins and are used for stale cleanup.
  const sessionDir = path.join(rootDir, "sessions");

  return { rootDir, binDir, sessionDir };
}

// Checks if PATH already contains a directory so we can avoid noisy setup hints.
export function pathContainsDir(currentPath: string | undefined, targetDir: string): boolean {
  if (!currentPath) {
    return false;
  }
  const resolvedTarget = path.resolve(targetDir);
  const parts = currentPath.split(path.delimiter).map((item) => path.resolve(item));
  return parts.includes(resolvedTarget);
}
