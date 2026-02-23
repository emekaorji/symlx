import os from 'node:os';
import path from 'node:path';

import type { SymlxPaths } from './types';

export function getSymlxPaths(binDir: string): SymlxPaths {
  // Keep mutable runtime state under the user's home directory.
  // Session files live separately from bins and are used for stale cleanup.
  const sessionDir = path.join(os.homedir(), '.symlx', 'sessions');

  return { binDir, sessionDir };
}

// Checks if PATH already contains a directory so we can avoid noisy setup hints.
export function pathContainsDir(
  currentPath: string | undefined,
  targetDir: string,
): boolean {
  if (!currentPath) {
    return false;
  }
  const resolvedTarget = path.resolve(targetDir);
  const parts = currentPath
    .split(path.delimiter)
    .map((item) => path.resolve(item));
  return parts.includes(resolvedTarget);
}
