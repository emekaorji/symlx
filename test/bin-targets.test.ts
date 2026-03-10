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

function writeTarget(filePath: string, mode = 0o644): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, '#!/usr/bin/env node\nconsole.log("ok")\n');
  fs.chmodSync(filePath, mode);
}

function writeTsxBinary(projectDirectory: string): string {
  const tsxPath = path.join(projectDirectory, 'node_modules', '.bin', 'tsx');
  fs.mkdirSync(path.dirname(tsxPath), { recursive: true });
  fs.writeFileSync(tsxPath, '#!/bin/sh\nexit 0\n');
  fs.chmodSync(tsxPath, 0o755);
  return tsxPath;
}

test('rejects missing target files', () => {
  withTempDir((dirPath) => {
    const missingTarget = path.join(dirPath, 'dist', 'cli.js');
    assert.throws(
      () => prepareBinTargets(dirPath, { 'my-cli': missingTarget }, ''),
      /target file does not exist/,
    );
  });
});

test('rejects directory targets', () => {
  withTempDir((dirPath) => {
    const targetDirectory = path.join(dirPath, 'dist');
    fs.mkdirSync(targetDirectory, { recursive: true });

    assert.throws(
      () => prepareBinTargets(dirPath, { 'my-cli': targetDirectory }, ''),
      /target is a directory/,
    );
  });
});

test('prepares executable JavaScript targets as symlinks', () => {
  withTempDir((dirPath) => {
    const filePath = path.join(dirPath, 'cli.js');
    writeTarget(filePath, 0o755);

    const result = prepareBinTargets(dirPath, { 'my-cli': filePath }, '');
    assert.deepEqual(result, [
      { name: 'my-cli', target: filePath, kind: 'symlink' },
    ]);
  });
});

test('makes non-executable JavaScript targets executable on unix-like systems', () => {
  if (process.platform === 'win32') {
    return;
  }

  withTempDir((dirPath) => {
    const filePath = path.join(dirPath, 'cli.js');
    writeTarget(filePath, 0o644);

    const result = prepareBinTargets(dirPath, { 'my-cli': filePath }, '');
    assert.deepEqual(result, [
      { name: 'my-cli', target: filePath, kind: 'symlink' },
    ]);
    fs.accessSync(filePath, fs.constants.X_OK);
  });
});

test('prepares TypeScript targets as tsx launchers', () => {
  withTempDir((dirPath) => {
    const targetPath = path.join(dirPath, 'src', 'cli.ts');
    writeTarget(targetPath, 0o644);
    const runtimeCommand = writeTsxBinary(dirPath);

    const result = prepareBinTargets(dirPath, { 'my-cli': targetPath }, '');
    assert.deepEqual(result, [
      {
        name: 'my-cli',
        target: targetPath,
        kind: 'tsx-launcher',
        runtimeCommand,
      },
    ]);
  });
});

test('rejects TypeScript targets when tsx cannot be resolved', () => {
  withTempDir((dirPath) => {
    const targetPath = path.join(dirPath, 'src', 'cli.ts');
    writeTarget(targetPath, 0o644);

    assert.throws(
      () => prepareBinTargets(dirPath, { 'my-cli': targetPath }, ''),
      /tsx runtime could not be resolved/,
    );
  });
});
