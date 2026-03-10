import fs from 'node:fs';

import type { PreparedBinTarget } from './types';
import { isTypeScriptTarget, resolveTsxRuntime } from './tsx-runtime';

type BinTargetIssue = {
  name: string;
  target: string;
  reason: string;
  hint?: string;
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

export function prepareBinTargets(
  cwd: string,
  bin: Record<string, string>,
  currentPath: string | undefined = process.env.PATH,
): PreparedBinTarget[] {
  const preparedTargets: PreparedBinTarget[] = [];
  const issues: BinTargetIssue[] = [];
  let resolvedTsxRuntime: string | null | undefined;

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

    if (isTypeScriptTarget(target)) {
      if (resolvedTsxRuntime === undefined) {
        resolvedTsxRuntime = resolveTsxRuntime(cwd, currentPath) ?? null;
      }

      if (!resolvedTsxRuntime) {
        issues.push({
          name,
          target,
          reason: 'tsx runtime could not be resolved for TypeScript target',
          hint: 'install tsx in the project or make tsx available on PATH',
        });
        continue;
      }

      preparedTargets.push({
        name,
        target,
        kind: 'tsx-launcher',
        runtimeCommand: resolvedTsxRuntime,
      });
      continue;
    }

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
      kind: 'symlink',
    });
  }

  if (issues.length === 0) {
    return preparedTargets;
  }

  throw new Error(
    [
      'invalid bin targets:',
      formatIssues(issues),
      'fix bin paths, runtime setup, or file permissions in package.json, symlx.config.json, or inline --bin and run again.',
    ].join('\n'),
  );
}
