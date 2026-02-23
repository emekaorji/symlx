import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const PREFIX = '[symlx]';
const START = '# >>> symlx path >>>';
const END = '# <<< symlx path <<<';
const BIN_PATH = '$HOME/.symlx/bin';
const PROFILE_BASENAMES = ['.zprofile', '.zshrc', '.bashrc'];

function info(message: string): void {
  process.stdout.write(`${PREFIX} ${message}\n`);
}

function warn(message: string): void {
  process.stderr.write(`${PREFIX} ${message}\n`);
}

function printManualPathSetupGuidance(): void {
  if (process.platform === 'win32') {
    info('manual setup (PowerShell):');
    info(
      '[Environment]::SetEnvironmentVariable("Path", "$env:USERPROFILE\\\\.symlx\\\\bin;$env:Path", "User")',
    );
    info('then open a new terminal');
    return;
  }

  info('manual setup: add this to ~/.zshrc, ~/.zprofile, or ~/.bashrc');
  info(START);
  info('if [[ ":$PATH:" != *":$HOME/.symlx/bin:"* ]]; then');
  info('  export PATH="$HOME/.symlx/bin:$PATH"');
  info('fi');
  info(END);
  info('then run: source ~/.zshrc (or your active shell profile)');
}

function resolveProfilePaths(homeDir: string): string[] {
  return PROFILE_BASENAMES.map((basename) => path.join(homeDir, basename));
}

function toHomeRelativePath(filePath: string, homeDir: string): string {
  if (filePath.startsWith(`${homeDir}${path.sep}`)) {
    return `~/${path.relative(homeDir, filePath)}`;
  }
  return filePath;
}

function getPreferredSourcePath(updatedPaths: string[]): string | undefined {
  const shell = process.env.SHELL ?? '';
  const preferredBasename = shell.includes('zsh')
    ? '.zshrc'
    : shell.includes('bash')
      ? '.bashrc'
      : undefined;

  if (!preferredBasename) {
    return updatedPaths[0];
  }

  return (
    updatedPaths.find((filePath) => path.basename(filePath) === preferredBasename) ??
    updatedPaths[0]
  );
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildPathBlock(): string {
  return [
    START,
    `if [[ ":$PATH:" != *":${BIN_PATH}:"* ]]; then`,
    `  export PATH="${BIN_PATH}:$PATH"`,
    'fi',
    END,
  ].join('\n');
}

function ensureTrailingNewline(value: string): string {
  return value.endsWith('\n') ? value : `${value}\n`;
}

function upsertProfileBlock(filePath: string, block: string): boolean {
  const exists = fs.existsSync(filePath);
  const current = exists ? fs.readFileSync(filePath, 'utf8') : '';
  const normalizedCurrent = current.replace(/\r\n/g, '\n');

  const markerPattern = new RegExp(
    `${escapeRegExp(START)}[\\s\\S]*?${escapeRegExp(END)}\\n?`,
    'm',
  );

  let next: string;
  if (markerPattern.test(normalizedCurrent)) {
    next = normalizedCurrent.replace(markerPattern, `${block}\n`);
  } else if (normalizedCurrent.trim().length === 0) {
    next = `${block}\n`;
  } else {
    next = `${ensureTrailingNewline(normalizedCurrent)}\n${block}\n`;
  }

  if (next === normalizedCurrent) {
    return false;
  }

  fs.writeFileSync(filePath, next, 'utf8');
  return true;
}

function run(): void {
  if (process.env.SYMLX_SKIP_PATH_SETUP === '1') {
    info('skipping PATH setup because SYMLX_SKIP_PATH_SETUP=1');
    printManualPathSetupGuidance();
    return;
  }

  if (process.platform === 'win32') {
    info('skipping shell profile PATH setup on Windows');
    printManualPathSetupGuidance();
    return;
  }

  const homeDir = os.homedir();
  if (!homeDir) {
    warn('could not resolve home directory; skipping PATH setup');
    printManualPathSetupGuidance();
    return;
  }

  const block = buildPathBlock();
  const profilePaths = resolveProfilePaths(homeDir);
  const existingPaths = profilePaths.filter((filePath) => fs.existsSync(filePath));
  const targets = existingPaths.length > 0 ? existingPaths : [profilePaths[0]];

  const updated: string[] = [];
  for (const target of targets) {
    try {
      const changed = upsertProfileBlock(target, block);
      if (changed) {
        updated.push(target);
      }
    } catch (error) {
      warn(`could not update ${target}: ${String(error)}`);
    }
  }

  if (updated.length > 0) {
    info(`added ${BIN_PATH} to PATH in:`);
    for (const target of updated) {
      info(`- ${target}`);
    }
    const preferredSourcePath = getPreferredSourcePath(updated);
    if (preferredSourcePath) {
      const sourceTarget = toHomeRelativePath(preferredSourcePath, homeDir);
      info(`run now: source ${sourceTarget}`);
    }
    info('or open a new shell to apply immediately');
  } else {
    info(`PATH setup already present (${BIN_PATH})`);
  }
}

run();
