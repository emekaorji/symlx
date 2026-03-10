import fs from 'node:fs';
import path from 'node:path';

import type { LauncherKind } from './types';

const NODE_TARGET_EXTENSIONS = new Set(['.js', '.mjs', '.cjs']);
const TYPESCRIPT_TARGET_EXTENSIONS = new Set(['.ts', '.tsx', '.mts', '.cts']);
const LAUNCHER_MARKER = '// symlx:launcher';

type LauncherDefinition = {
  kind: LauncherKind;
  supportsTarget: (target: string) => boolean;
  resolveRuntime: (
    cwd: string,
    currentPath: string | undefined,
  ) => string | undefined;
  missingRuntimeHint: string;
};

type ResolvedLauncher = {
  launcherKind: LauncherKind;
  runtimeCommand: string;
};

type LauncherIssue = {
  reason: string;
  hint: string;
};

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

function createLauncherContent(
  launcherKind: LauncherKind,
  runtimeCommand: string,
  target: string,
): string {
  return `#!/usr/bin/env node
${LAUNCHER_MARKER} kind=${launcherKind}
const { spawnSync } = require('node:child_process');

const launcherKind = ${JSON.stringify(launcherKind)};
const runtimeCommand = ${JSON.stringify(runtimeCommand)};
const targetPath = ${JSON.stringify(target)};

const result = spawnSync(
  runtimeCommand,
  [targetPath, ...process.argv.slice(2)],
  { stdio: 'inherit' },
);

if (result.error) {
  process.stderr.write(
    '[symlx] failed to launch target via ' +
      launcherKind +
      ': ' +
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

const LAUNCHERS: LauncherDefinition[] = [
  {
    kind: 'node',
    supportsTarget: (target) =>
      NODE_TARGET_EXTENSIONS.has(path.extname(target).toLowerCase()),
    resolveRuntime: () => process.execPath,
    missingRuntimeHint: 'node runtime could not be resolved',
  },
  {
    kind: 'tsx',
    supportsTarget: (target) =>
      TYPESCRIPT_TARGET_EXTENSIONS.has(path.extname(target).toLowerCase()),
    resolveRuntime: (cwd, currentPath) => {
      const localCandidate = path.join(cwd, 'node_modules', '.bin', 'tsx');
      if (isExecutable(localCandidate)) {
        return localCandidate;
      }

      return resolveExecutableOnPath('tsx', currentPath);
    },
    missingRuntimeHint: 'install tsx in the project or make tsx available on PATH',
  },
];

function findLauncherDefinition(target: string): LauncherDefinition | undefined {
  return LAUNCHERS.find((launcher) => launcher.supportsTarget(target));
}

export function inferLauncherKind(target: string): LauncherKind | undefined {
  return findLauncherDefinition(target)?.kind;
}

export function resolveInferredLauncher(
  cwd: string,
  target: string,
  currentPath: string | undefined = process.env.PATH,
): ResolvedLauncher | LauncherIssue | undefined {
  const launcher = findLauncherDefinition(target);
  if (!launcher) {
    return undefined;
  }

  const runtimeCommand = launcher.resolveRuntime(cwd, currentPath);
  if (runtimeCommand) {
    return {
      launcherKind: launcher.kind,
      runtimeCommand,
    };
  }

  return {
    reason: `${launcher.kind} runtime could not be resolved for target`,
    hint: launcher.missingRuntimeHint,
  };
}

export function writeLauncher(
  linkPath: string,
  launcherKind: LauncherKind,
  runtimeCommand: string,
  target: string,
): void {
  fs.writeFileSync(
    linkPath,
    createLauncherContent(launcherKind, runtimeCommand, target),
    'utf8',
  );
  fs.chmodSync(linkPath, 0o755);
}

export function matchesLauncher(
  linkPath: string,
  launcherKind: LauncherKind,
  runtimeCommand: string,
  target: string,
): boolean {
  try {
    const content = fs.readFileSync(linkPath, 'utf8');
    return (
      content === createLauncherContent(launcherKind, runtimeCommand, target)
    );
  } catch {
    return false;
  }
}
