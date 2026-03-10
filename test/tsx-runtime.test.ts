import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

import {
  isTypeScriptTarget,
  resolveTsxRuntime,
} from '../src/lib/tsx-runtime';

function withTempDir(run: (dirPath: string) => void): void {
  const dirPath = fs.mkdtempSync(path.join(os.tmpdir(), 'symlx-tsx-runtime-'));
  try {
    run(dirPath);
  } finally {
    fs.rmSync(dirPath, { recursive: true, force: true });
  }
}

function writeExecutable(filePath: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, '#!/bin/sh\nexit 0\n');
  fs.chmodSync(filePath, 0o755);
}

test('isTypeScriptTarget detects supported TypeScript extensions', () => {
  assert.equal(isTypeScriptTarget('/tmp/cli.ts'), true);
  assert.equal(isTypeScriptTarget('/tmp/cli.tsx'), true);
  assert.equal(isTypeScriptTarget('/tmp/cli.mts'), true);
  assert.equal(isTypeScriptTarget('/tmp/cli.cts'), true);
  assert.equal(isTypeScriptTarget('/tmp/cli.js'), false);
});

test('resolveTsxRuntime prefers project-local tsx over PATH', () => {
  withTempDir((dirPath) => {
    const localTsx = path.join(dirPath, 'node_modules', '.bin', 'tsx');
    const pathTsx = path.join(dirPath, 'path-bin', 'tsx');
    writeExecutable(localTsx);
    writeExecutable(pathTsx);

    const result = resolveTsxRuntime(dirPath, path.dirname(pathTsx));
    assert.equal(result, localTsx);
  });
});

test('resolveTsxRuntime falls back to PATH when local tsx is absent', () => {
  withTempDir((dirPath) => {
    const pathTsx = path.join(dirPath, 'path-bin', 'tsx');
    writeExecutable(pathTsx);

    const result = resolveTsxRuntime(dirPath, path.dirname(pathTsx));
    assert.equal(result, pathTsx);
  });
});

test('resolveTsxRuntime returns undefined when tsx cannot be resolved', () => {
  withTempDir((dirPath) => {
    const result = resolveTsxRuntime(dirPath, '');
    assert.equal(result, undefined);
  });
});
