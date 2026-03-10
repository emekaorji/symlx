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

function writeTarget(
  filePath: string,
  {
    content = 'console.log("ok")\n',
    mode = 0o644,
  }: {
    content?: string;
    mode?: number;
  } = {},
): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
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
      () => prepareBinTargets(dirPath, { 'my-cli': missingTarget }),
      /target file does not exist/,
    );
  });
});

test('rejects directory targets', () => {
  withTempDir((dirPath) => {
    const targetDirectory = path.join(dirPath, 'dist');
    fs.mkdirSync(targetDirectory, { recursive: true });

    assert.throws(
      () => prepareBinTargets(dirPath, { 'my-cli': targetDirectory }),
      /target is a directory/,
    );
  });
});

test('links shebang-bearing targets directly', () => {
  withTempDir((dirPath) => {
    const filePath = path.join(dirPath, 'cli.js');
    writeTarget(filePath, {
      content: '#!/usr/bin/env node\nconsole.log("ok")\n',
      mode: 0o755,
    });

    const result = prepareBinTargets(dirPath, { 'my-cli': filePath });
    assert.deepEqual(result, [
      { name: 'my-cli', target: filePath, kind: 'direct-link' },
    ]);
  });
});

test('makes shebang-bearing targets executable on unix-like systems', () => {
  if (process.platform === 'win32') {
    return;
  }

  withTempDir((dirPath) => {
    const filePath = path.join(dirPath, 'cli.js');
    writeTarget(filePath, {
      content: '#!/usr/bin/env node\nconsole.log("ok")\n',
      mode: 0o644,
    });

    const result = prepareBinTargets(dirPath, { 'my-cli': filePath });
    assert.deepEqual(result, [
      { name: 'my-cli', target: filePath, kind: 'direct-link' },
    ]);
    fs.accessSync(filePath, fs.constants.X_OK);
  });
});

test('infers node launcher for JavaScript targets without a shebang', () => {
  withTempDir((dirPath) => {
    const filePath = path.join(dirPath, 'cli.js');
    writeTarget(filePath);

    const result = prepareBinTargets(dirPath, { 'my-cli': filePath });

    assert.deepEqual(result, [
      {
        name: 'my-cli',
        target: filePath,
        kind: 'launcher',
        launcherKind: 'node',
        runtimeCommand: process.execPath,
      },
    ]);
  });
});

test('infers tsx launcher for TypeScript targets without a shebang', () => {
  withTempDir((dirPath) => {
    const targetPath = path.join(dirPath, 'src', 'cli.ts');
    writeTarget(targetPath);
    const runtimeCommand = writeTsxBinary(dirPath);

    const result = prepareBinTargets(dirPath, { 'my-cli': targetPath });

    assert.deepEqual(result, [
      {
        name: 'my-cli',
        target: targetPath,
        kind: 'launcher',
        launcherKind: 'tsx',
        runtimeCommand,
      },
    ]);
  });
});

test('rejects unsupported targets without shebang with manual-shebang guidance', () => {
  withTempDir((dirPath) => {
    const targetPath = path.join(dirPath, 'scripts', 'cli.py');
    writeTarget(targetPath);

    assert.throws(
      () => prepareBinTargets(dirPath, { 'my-cli': targetPath }),
      /not supported yet without shebang/,
    );

    assert.throws(
      () => prepareBinTargets(dirPath, { 'my-cli': targetPath }),
      /explicitly specify a shebang/,
    );
  });
});

test('rejects TypeScript target when tsx runtime is unavailable and no shebang exists', () => {
  withTempDir((dirPath) => {
    const targetPath = path.join(dirPath, 'src', 'cli.ts');
    writeTarget(targetPath);

    assert.throws(
      () =>
        prepareBinTargets(dirPath, { 'my-cli': targetPath }, { currentPath: '' }),
      /not supported yet without shebang/,
    );

    assert.throws(
      () =>
        prepareBinTargets(dirPath, { 'my-cli': targetPath }, { currentPath: '' }),
      /explicitly specify a shebang/,
    );
  });
});
