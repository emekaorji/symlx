import fs from 'node:fs';
import path from 'node:path';

import { Options } from './schema';

import type { PackageJson } from './types';

// Invalid/corrupted JSON files are ignored.
export function loadJSONFile<T>(filePath: string): T | undefined {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw) as T;
  } catch {
    return undefined;
  }
}

export function loadConfigFileOptions() {
  const cwd = process.cwd();
  const configPath = path.join(cwd, 'symlx.config.json');
  const configFileOptions = loadJSONFile<Options>(configPath);
  return configFileOptions;
}

// npm allows `bin` as a string; in that form the command name defaults to package name
// (without scope for scoped packages).
function inferBinName(packageName: string | undefined): string | undefined {
  if (!packageName) {
    return undefined;
  }

  if (packageName.startsWith('@')) {
    const parts = packageName.split('/');
    if (parts.length !== 2 || !parts[1]) {
      return undefined;
    }
    return parts[1];
  }

  return packageName;
}

// Loads and validates all bin entries for the current project.
// Returned map is command name => absolute target file path.
export function loadPackageJSONOptions(cwd: string): {
  bin: Record<string, string>;
} {
  const packageJsonPath = path.join(cwd, 'package.json');
  if (!fs.existsSync(packageJsonPath)) {
    return {
      bin: {},
    };
  }

  const packageJson = loadJSONFile<PackageJson>(packageJsonPath);
  if (!packageJson || !packageJson.bin) {
    return {
      bin: {},
    };
  }

  const bin: Record<string, string> = {};

  if (typeof packageJson.bin === 'string') {
    const inferredBinName = inferBinName(packageJson.name);
    if (inferredBinName) {
      bin[inferredBinName] = path.resolve(cwd, packageJson.bin);
    }
  } else {
    for (const [name, relTarget] of Object.entries(packageJson.bin)) {
      bin[name] = path.resolve(cwd, relTarget);
    }
  }

  return { bin };
}

// Session files are best-effort state; deletion failure should not fail the command.
export function deleteFile(filePath: string): void {
  try {
    fs.unlinkSync(filePath);
  } catch {
    // Best-effort cleanup.
  }
}

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
