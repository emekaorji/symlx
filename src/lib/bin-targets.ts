import fs from 'node:fs';

import { resolveInferredLauncher } from './launchers';
import { hasShebang } from './shebang';
import type { PreparedBinTarget } from './types';

type BinTargetIssue = {
  name: string;
  target: string;
  reason: string;
  hint?: string;
};

type PrepareBinTargetsOptions = {
  currentPath?: string | undefined;
};

function isExecutable(filePath: string): boolean {
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

function ensureExecutable(
  filePath: string,
  currentMode: number,
): string | undefined {
  if (process.platform === 'win32' || isExecutable(filePath)) {
    return undefined;
  }

  const executeBits = (currentMode & 0o444) >> 2;
  const nextMode = (currentMode | executeBits) & 0o777;

  try {
    fs.chmodSync(filePath, nextMode);
  } catch (error) {
    return `target permissions could not be updated (${String(error)})`;
  }

  if (isExecutable(filePath)) {
    return undefined;
  }

  return 'target permissions could not be updated';
}

function formatIssues(issues: BinTargetIssue[]): string {
  return issues
    .map((issue) => {
      const hint = issue.hint ? ` (${issue.hint})` : '';
      return `- ${issue.name} -> ${issue.target}: ${issue.reason}${hint}`;
    })
    .join('\n');
}

function addUnsupportedWithoutShebangIssue(
  issues: BinTargetIssue[],
  name: string,
  target: string,
  reason?: string,
): void {
  const detail = reason ? ` (${reason})` : '';
  issues.push({
    name,
    target,
    reason: `not supported yet without shebang${detail}`,
    hint:
      'explicitly specify a shebang at the top of the target file to declare its runner',
  });
}

export function prepareBinTargets(
  cwd: string,
  bin: Record<string, string>,
  options: PrepareBinTargetsOptions = {},
): PreparedBinTarget[] {
  const currentPath = options.currentPath ?? process.env.PATH;
  const preparedTargets: PreparedBinTarget[] = [];
  const issues: BinTargetIssue[] = [];

  for (const [name, target] of Object.entries(bin)) {
    if (!fs.existsSync(target)) {
      issues.push({
        name,
        target,
        reason: 'target file does not exist',
      });
      continue;
    }

    let stats: fs.Stats;
    try {
      stats = fs.statSync(target);
    } catch (error) {
      issues.push({
        name,
        target,
        reason: `target cannot be accessed (${String(error)})`,
      });
      continue;
    }

    if (stats.isDirectory()) {
      issues.push({
        name,
        target,
        reason: 'target is a directory',
      });
      continue;
    }

    if (hasShebang(target)) {
      const executableIssue = ensureExecutable(target, stats.mode);
      if (executableIssue) {
        issues.push({
          name,
          target,
          reason: executableIssue,
          hint: `run: chmod +x ${target}`,
        });
        continue;
      }

      preparedTargets.push({
        name,
        target,
        kind: 'direct-link',
      });
      continue;
    }

    const launcher = resolveInferredLauncher(cwd, target, currentPath);
    if (!launcher) {
      addUnsupportedWithoutShebangIssue(issues, name, target);
      continue;
    }

    if ('reason' in launcher) {
      addUnsupportedWithoutShebangIssue(issues, name, target, launcher.reason);
      continue;
    }

    preparedTargets.push({
      name,
      target,
      kind: 'launcher',
      launcherKind: launcher.launcherKind,
      runtimeCommand: launcher.runtimeCommand,
    });
  }

  if (issues.length === 0) {
    return preparedTargets;
  }

  throw new Error(
    [
      'invalid bin targets:',
      formatIssues(issues),
      'fix bin paths, launcher support, shebang declarations, or file permissions in package.json, symlx.config.json, or inline --bin and run again.',
    ].join('\n'),
  );
}
