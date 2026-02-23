import fs from 'node:fs';

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

function inspectBinTarget(name: string, target: string): BinTargetIssue | undefined {
  if (!fs.existsSync(target)) {
    return {
      name,
      target,
      reason: 'target file does not exist',
    };
  }

  let stats: fs.Stats;
  try {
    stats = fs.statSync(target);
  } catch (error) {
    return {
      name,
      target,
      reason: `target cannot be accessed (${String(error)})`,
    };
  }

  if (stats.isDirectory()) {
    return {
      name,
      target,
      reason: 'target is a directory',
    };
  }

  if (!isExecutable(target)) {
    return {
      name,
      target,
      reason: 'target is not executable',
      hint: `run: chmod +x ${target}`,
    };
  }

  return undefined;
}

function formatIssues(issues: BinTargetIssue[]): string {
  return issues
    .map((issue) => {
      const hint = issue.hint ? ` (${issue.hint})` : '';
      return `- ${issue.name} -> ${issue.target}: ${issue.reason}${hint}`;
    })
    .join('\n');
}

export function assertValidBinTargets(bin: Record<string, string>): void {
  const issues: BinTargetIssue[] = [];

  for (const [name, target] of Object.entries(bin)) {
    const issue = inspectBinTarget(name, target);
    if (issue) {
      issues.push(issue);
    }
  }

  if (issues.length === 0) {
    return;
  }

  throw new Error(
    [
      'invalid bin targets:',
      formatIssues(issues),
      'fix bin paths/permissions in package.json, symlx.config.json, or inline --bin and run again.',
    ].join('\n'),
  );
}
