import fs from 'node:fs';
import path from 'node:path';

export function readShebang(filePath: string): string | undefined {
  const raw = fs.readFileSync(filePath, 'utf8');
  const firstLine = raw.split(/\r?\n/, 1)[0]?.replace(/^\uFEFF/, '');

  if (!firstLine?.startsWith('#!')) {
    return undefined;
  }

  return firstLine;
}

function tokenizeShebangCommand(shebang: string): string[] {
  return shebang
    .slice(2)
    .trim()
    .split(/\s+/)
    .map((token) => token.replace(/^['"]|['"]$/g, ''))
    .filter(Boolean);
}

export function extractShebangRuntime(shebang: string): string | undefined {
  const tokens = tokenizeShebangCommand(shebang);
  if (tokens.length === 0) {
    return undefined;
  }

  const command = tokens[0];
  const commandBase = path.basename(command).toLowerCase();

  if (commandBase === 'env') {
    // env-style shebangs can include flags before the actual runtime command.
    const runtimeToken = tokens.slice(1).find((token) => !token.startsWith('-'));
    if (!runtimeToken) {
      return undefined;
    }
    return path.basename(runtimeToken).toLowerCase();
  }

  return commandBase;
}

export function readShebangRuntime(filePath: string): string | undefined {
  const shebang = readShebang(filePath);
  if (!shebang) {
    return undefined;
  }
  return extractShebangRuntime(shebang);
}

export function hasShebang(filePath: string): boolean {
  return Boolean(readShebang(filePath));
}
