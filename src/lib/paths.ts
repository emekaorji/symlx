import path from 'node:path';

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
