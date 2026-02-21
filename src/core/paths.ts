import os from "node:os";
import path from "node:path";

import type { ZlxPaths } from "./types";

export function getZlxPaths(customBinDir?: string): ZlxPaths {
  const rootDir = path.join(os.homedir(), ".zlx");
  const binDir = customBinDir ? path.resolve(customBinDir) : path.join(rootDir, "bin");
  const sessionDir = path.join(rootDir, "sessions");

  return { rootDir, binDir, sessionDir };
}

export function pathContainsDir(currentPath: string | undefined, targetDir: string): boolean {
  if (!currentPath) {
    return false;
  }
  const resolvedTarget = path.resolve(targetDir);
  const parts = currentPath.split(path.delimiter).map((item) => path.resolve(item));
  return parts.includes(resolvedTarget);
}
