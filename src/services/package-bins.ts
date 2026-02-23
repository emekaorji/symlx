import fs from 'node:fs';
import path from 'node:path';

import type { PackageJson } from '../lib/types';
import { loadJSONFile } from '../lib/utils';

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
