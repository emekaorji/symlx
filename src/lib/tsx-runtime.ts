import fs from 'node:fs';
import path from 'node:path';

const TYPESCRIPT_TARGET_EXTENSIONS = new Set(['.ts', '.tsx', '.mts', '.cts']);
const TSX_LAUNCHER_MARKER = '// symlx:tsx-launcher';

function isExecutable(filePath: string): boolean {
  if (!fs.existsSync(filePath)) {
    return false;
  }

  if (process.platform === 'win32') {
    return true;
  }

  try {
    fs.accessSync(filePath, fs.constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

function resolveExecutableOnPath(
  commandName: string,
  currentPath: string | undefined,
): string | undefined {
  if (!currentPath) {
    return undefined;
  }

  for (const directory of currentPath.split(path.delimiter)) {
    if (!directory) {
      continue;
    }

    const candidate = path.join(directory, commandName);
    if (isExecutable(candidate)) {
      return candidate;
    }
  }

  return undefined;
}

export function isTypeScriptTarget(target: string): boolean {
  return TYPESCRIPT_TARGET_EXTENSIONS.has(path.extname(target).toLowerCase());
}

export function resolveTsxRuntime(
  cwd: string,
  currentPath: string | undefined = process.env.PATH,
): string | undefined {
  const localCandidate = path.join(cwd, 'node_modules', '.bin', 'tsx');
  if (isExecutable(localCandidate)) {
    return localCandidate;
  }

  return resolveExecutableOnPath('tsx', currentPath);
}

export function createTsxLauncherContent(
  runtimeCommand: string,
  target: string,
): string {
  return `#!/usr/bin/env node
${TSX_LAUNCHER_MARKER}
const { spawnSync } = require('node:child_process');

const runtimeCommand = ${JSON.stringify(runtimeCommand)};
const targetPath = ${JSON.stringify(target)};

const result = spawnSync(
  runtimeCommand,
  [targetPath, ...process.argv.slice(2)],
  { stdio: 'inherit' },
);

if (result.error) {
  process.stderr.write(
    '[symlx] failed to launch TypeScript target via tsx: ' +
      String(result.error) +
      '\\n',
  );
  process.exit(1);
}

if (typeof result.status === 'number') {
  process.exit(result.status);
}

if (result.signal) {
  process.kill(process.pid, result.signal);
}

process.exit(1);
`;
}

export function writeTsxLauncher(
  linkPath: string,
  runtimeCommand: string,
  target: string,
): void {
  fs.writeFileSync(
    linkPath,
    createTsxLauncherContent(runtimeCommand, target),
    'utf8',
  );
  fs.chmodSync(linkPath, 0o755);
}

export function matchesTsxLauncher(
  linkPath: string,
  runtimeCommand: string,
  target: string,
): boolean {
  try {
    const content = fs.readFileSync(linkPath, 'utf8');
    return content === createTsxLauncherContent(runtimeCommand, target);
  } catch {
    return false;
  }
}

export { TSX_LAUNCHER_MARKER };
