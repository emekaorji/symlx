import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

import { matchesLauncher, writeLauncher } from '../src/lib/launchers';
import { createLinks } from '../src/lib/link-manager';
import type { PreparedBinTarget } from '../src/lib/types';

function withTempDir(run: (dirPath: string) => Promise<void> | void): Promise<void> {
  const dirPath = fs.mkdtempSync(path.join(os.tmpdir(), 'symlx-link-test-'));

  return Promise.resolve(run(dirPath)).finally(() => {
    fs.rmSync(dirPath, { recursive: true, force: true });
  });
}

function createTargetFile(dirPath: string, basename: string): string {
  const filePath = path.join(dirPath, basename);
  fs.writeFileSync(filePath, '#!/usr/bin/env node\nconsole.log("ok")\n');
  fs.chmodSync(filePath, 0o755);
  return filePath;
}

const isWindows = process.platform === 'win32';

test('createLinks creates symlinks for direct-link targets', { skip: isWindows }, async () => {
  await withTempDir(async (dirPath) => {
    const binDir = path.join(dirPath, 'bin');
    fs.mkdirSync(binDir, { recursive: true });

    const target = createTargetFile(dirPath, 'cli.js');
    const preparedTargets: PreparedBinTarget[] = [
      { name: 'my-cli', target, kind: 'direct-link' },
    ];

    const result = await createLinks(preparedTargets, binDir, 'fail');

    assert.equal(result.created.length, 1);
    assert.equal(result.skipped.length, 0);

    const linkPath = path.join(binDir, 'my-cli');
    assert.equal(fs.lstatSync(linkPath).isSymbolicLink(), true);
    assert.equal(
      path.resolve(path.dirname(linkPath), fs.readlinkSync(linkPath)),
      target,
    );
  });
});

test('createLinks creates launchers for inferred runtime targets', { skip: isWindows }, async () => {
  await withTempDir(async (dirPath) => {
    const binDir = path.join(dirPath, 'bin');
    fs.mkdirSync(binDir, { recursive: true });

    const target = path.join(dirPath, 'cli.ts');
    fs.writeFileSync(target, 'console.log("ok")\n');
    const runtimeCommand = path.join(dirPath, 'tsx');

    const preparedTargets: PreparedBinTarget[] = [
      {
        name: 'my-cli',
        target,
        kind: 'launcher',
        launcherKind: 'tsx',
        runtimeCommand,
      },
    ];

    const result = await createLinks(preparedTargets, binDir, 'fail');

    assert.equal(result.created.length, 1);
    const linkPath = path.join(binDir, 'my-cli');
    assert.equal(fs.lstatSync(linkPath).isFile(), true);
    assert.equal(fs.lstatSync(linkPath).isSymbolicLink(), false);
    assert.equal(matchesLauncher(linkPath, 'tsx', runtimeCommand, target), true);
    fs.accessSync(linkPath, fs.constants.X_OK);
  });
});

test('createLinks skip policy skips existing file conflicts', { skip: isWindows }, async () => {
  await withTempDir(async (dirPath) => {
    const binDir = path.join(dirPath, 'bin');
    fs.mkdirSync(binDir, { recursive: true });

    const target = createTargetFile(dirPath, 'cli.js');
    const existingPath = path.join(binDir, 'my-cli');
    fs.writeFileSync(existingPath, 'existing');

    const result = await createLinks(
      [{ name: 'my-cli', target, kind: 'direct-link' }],
      binDir,
      'skip',
    );

    assert.equal(result.created.length, 0);
    assert.equal(result.skipped.length, 1);
    assert.equal(fs.lstatSync(existingPath).isFile(), true);
  });
});

test('createLinks overwrite policy replaces existing file with direct link', { skip: isWindows }, async () => {
  await withTempDir(async (dirPath) => {
    const binDir = path.join(dirPath, 'bin');
    fs.mkdirSync(binDir, { recursive: true });

    const target = createTargetFile(dirPath, 'cli.js');
    const existingPath = path.join(binDir, 'my-cli');
    fs.writeFileSync(existingPath, 'existing');

    const result = await createLinks(
      [{ name: 'my-cli', target, kind: 'direct-link' }],
      binDir,
      'overwrite',
    );

    assert.equal(result.created.length, 1);
    assert.equal(fs.lstatSync(existingPath).isSymbolicLink(), true);
  });
});

test('createLinks fail policy throws on conflict', { skip: isWindows }, async () => {
  await withTempDir(async (dirPath) => {
    const binDir = path.join(dirPath, 'bin');
    fs.mkdirSync(binDir, { recursive: true });

    const target = createTargetFile(dirPath, 'cli.js');
    fs.writeFileSync(path.join(binDir, 'my-cli'), 'existing');

    await assert.rejects(
      () => createLinks([{ name: 'my-cli', target, kind: 'direct-link' }], binDir, 'fail'),
      /conflicts/,
    );
  });
});

test('createLinks skips when existing symlink already points to target', { skip: isWindows }, async () => {
  await withTempDir(async (dirPath) => {
    const binDir = path.join(dirPath, 'bin');
    fs.mkdirSync(binDir, { recursive: true });

    const target = createTargetFile(dirPath, 'cli.js');
    const linkPath = path.join(binDir, 'my-cli');
    fs.symlinkSync(target, linkPath);

    const result = await createLinks(
      [{ name: 'my-cli', target, kind: 'direct-link' }],
      binDir,
      'overwrite',
    );

    assert.equal(result.created.length, 0);
    assert.equal(result.skipped.length, 1);
    assert.match(result.skipped[0].reason, /already linked/);
  });
});

test('createLinks skips when existing launcher already matches target', { skip: isWindows }, async () => {
  await withTempDir(async (dirPath) => {
    const binDir = path.join(dirPath, 'bin');
    fs.mkdirSync(binDir, { recursive: true });

    const target = path.join(dirPath, 'cli.ts');
    fs.writeFileSync(target, 'console.log("ok")\n');
    const runtimeCommand = path.join(dirPath, 'tsx');
    const linkPath = path.join(binDir, 'my-cli');
    writeLauncher(linkPath, 'tsx', runtimeCommand, target);

    const result = await createLinks(
      [
        {
          name: 'my-cli',
          target,
          kind: 'launcher',
          launcherKind: 'tsx',
          runtimeCommand,
        },
      ],
      binDir,
      'overwrite',
    );

    assert.equal(result.created.length, 0);
    assert.equal(result.skipped.length, 1);
    assert.match(result.skipped[0].reason, /already linked/);
  });
});

test('createLinks refuses to overwrite directory collisions', { skip: isWindows }, async () => {
  await withTempDir(async (dirPath) => {
    const binDir = path.join(dirPath, 'bin');
    fs.mkdirSync(binDir, { recursive: true });

    const target = createTargetFile(dirPath, 'cli.js');
    fs.mkdirSync(path.join(binDir, 'my-cli'));

    await assert.rejects(
      () => createLinks([{ name: 'my-cli', target, kind: 'direct-link' }], binDir, 'overwrite'),
      /cannot overwrite directory/,
    );
  });
});
