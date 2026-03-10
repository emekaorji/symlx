import fs from 'node:fs';

export function readShebang(filePath: string): string | undefined {
  const raw = fs.readFileSync(filePath, 'utf8');
  const firstLine = raw.split(/\r?\n/, 1)[0]?.replace(/^\uFEFF/, '');

  if (!firstLine?.startsWith('#!')) {
    return undefined;
  }

  return firstLine;
}

export function hasShebang(filePath: string): boolean {
  return Boolean(readShebang(filePath));
}
