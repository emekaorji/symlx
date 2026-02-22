import fs from 'node:fs';
import path from 'node:path';
import { Options } from './schema';

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
