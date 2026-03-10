import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

import {
  inferLauncherKind,
  matchesLauncher,
  resolveInferredLauncher,
  writeLauncher,
} from '../src/lib/launchers';

function withTempDir(run: (dirPath: string) => void): void {
  const dirPath = fs.mkdtempSync(path.join(os.tmpdir(), 'symlx-launcher-test-'));
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

test('inferLauncherKind detects supported JavaScript and TypeScript extensions', () => {
  assert.equal(inferLauncherKind('/tmp/cli.js'), 'node');
  assert.equal(inferLauncherKind('/tmp/cli.mjs'), 'node');
  assert.equal(inferLauncherKind('/tmp/cli.cjs'), 'node');
  assert.equal(inferLauncherKind('/tmp/cli.ts'), 'tsx');
  assert.equal(inferLauncherKind('/tmp/cli.tsx'), 'tsx');
  assert.equal(inferLauncherKind('/tmp/cli.mts'), 'tsx');
  assert.equal(inferLauncherKind('/tmp/cli.cts'), 'tsx');
  assert.equal(inferLauncherKind('/tmp/cli.py'), undefined);
});

test('resolveInferredLauncher resolves node targets to the current node binary', () => {
  const result = resolveInferredLauncher('/tmp/project', '/tmp/project/dist/cli.js');

  assert.deepEqual(result, {
    launcherKind: 'node',
    runtimeCommand: process.execPath,
  });
});

test('resolveInferredLauncher prefers project-local tsx over PATH', () => {
  withTempDir((dirPath) => {
    const localTsx = path.join(dirPath, 'node_modules', '.bin', 'tsx');
    const pathTsx = path.join(dirPath, 'path-bin', 'tsx');
    writeExecutable(localTsx);
    writeExecutable(pathTsx);

    const result = resolveInferredLauncher(
      dirPath,
      path.join(dirPath, 'src', 'cli.ts'),
      path.dirname(pathTsx),
    );

    assert.deepEqual(result, {
      launcherKind: 'tsx',
      runtimeCommand: localTsx,
    });
  });
});

test('resolveInferredLauncher falls back to PATH when local tsx is absent', () => {
  withTempDir((dirPath) => {
    const pathTsx = path.join(dirPath, 'path-bin', 'tsx');
    writeExecutable(pathTsx);

    const result = resolveInferredLauncher(
      dirPath,
      path.join(dirPath, 'src', 'cli.ts'),
      path.dirname(pathTsx),
    );

    assert.deepEqual(result, {
      launcherKind: 'tsx',
      runtimeCommand: pathTsx,
    });
  });
});

test('resolveInferredLauncher returns a targeted issue when tsx cannot be resolved', () => {
  withTempDir((dirPath) => {
    const result = resolveInferredLauncher(
      dirPath,
      path.join(dirPath, 'src', 'cli.ts'),
      '',
    );

    assert.deepEqual(result, {
      reason: 'tsx runtime could not be resolved for target',
      hint: 'install tsx in the project or make tsx available on PATH',
    });
  });
});

test('writeLauncher creates content that matches the expected launcher contract', () => {
  withTempDir((dirPath) => {
    const linkPath = path.join(dirPath, 'bin', 'my-cli');
    fs.mkdirSync(path.dirname(linkPath), { recursive: true });

    writeLauncher(linkPath, 'node', process.execPath, '/tmp/project/dist/cli.js');

    assert.equal(
      matchesLauncher(linkPath, 'node', process.execPath, '/tmp/project/dist/cli.js'),
      true,
    );
    assert.equal(
      matchesLauncher(linkPath, 'tsx', process.execPath, '/tmp/project/dist/cli.js'),
      false,
    );
  });
});
