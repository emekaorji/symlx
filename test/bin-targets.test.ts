import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

import { prepareBinTargets } from '../src/lib/bin-targets';

function withTempDir(run: (dirPath: string) => void): void {
  const dirPath = fs.mkdtempSync(path.join(os.tmpdir(), 'symlx-target-test-'));
  try {
    run(dirPath);
  } finally {
    fs.rmSync(dirPath, { recursive: true, force: true });
  }
}

test('rejects missing target files', () => {
  withTempDir((dirPath) => {
    const missingTarget = path.join(dirPath, 'dist', 'cli.js');
    assert.throws(
      () => prepareBinTargets({ 'my-cli': missingTarget }),
      /target file does not exist/,
    );
  });
});

test('rejects directory targets', () => {
  withTempDir((dirPath) => {
    const targetDirectory = path.join(dirPath, 'dist');
    fs.mkdirSync(targetDirectory, { recursive: true });

    assert.throws(
      () => prepareBinTargets({ 'my-cli': targetDirectory }),
      /target is a directory/,
    );
  });
});

test('accepts executable files', () => {
  withTempDir((dirPath) => {
    const filePath = path.join(dirPath, 'cli.sh');
    fs.writeFileSync(filePath, '#!/usr/bin/env sh\necho ok\n');
    fs.chmodSync(filePath, 0o755);

    assert.doesNotThrow(() => {
      prepareBinTargets({ 'my-cli': filePath });
    });
  });
});

test('makes non-executable files executable on unix-like systems', () => {
  if (process.platform === 'win32') {
    return;
  }

  withTempDir((dirPath) => {
    const filePath = path.join(dirPath, 'cli.sh');
    fs.writeFileSync(filePath, '#!/usr/bin/env sh\necho ok\n');
    fs.chmodSync(filePath, 0o644);

    assert.doesNotThrow(() => {
      prepareBinTargets({ 'my-cli': filePath });
    });

    fs.accessSync(filePath, fs.constants.X_OK);
  });
});
