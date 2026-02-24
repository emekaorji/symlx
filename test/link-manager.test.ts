import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

import { createLinks } from '../src/lib/link-manager';

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

test('createLinks creates new symlinks for non-conflicting bins', { skip: isWindows }, async () => {
  await withTempDir(async (dirPath) => {
    const binDir = path.join(dirPath, 'bin');
    fs.mkdirSync(binDir, { recursive: true });

    const target = createTargetFile(dirPath, 'cli.js');

    const result = await createLinks({
      bins: new Map([['my-cli', target]]),
      binDir,
      policy: 'fail',
    });

    assert.equal(result.created.length, 1);
    assert.equal(result.skipped.length, 0);

    const linkPath = path.join(binDir, 'my-cli');
    assert.equal(fs.lstatSync(linkPath).isSymbolicLink(), true);
    assert.equal(path.resolve(path.dirname(linkPath), fs.readlinkSync(linkPath)), target);
  });
});

test('createLinks skip policy skips existing file conflicts', { skip: isWindows }, async () => {
  await withTempDir(async (dirPath) => {
    const binDir = path.join(dirPath, 'bin');
    fs.mkdirSync(binDir, { recursive: true });

    const target = createTargetFile(dirPath, 'cli.js');
    const existingPath = path.join(binDir, 'my-cli');
    fs.writeFileSync(existingPath, 'existing');

    const result = await createLinks({
      bins: new Map([['my-cli', target]]),
      binDir,
      policy: 'skip',
    });

    assert.equal(result.created.length, 0);
    assert.equal(result.skipped.length, 1);
    assert.equal(fs.lstatSync(existingPath).isFile(), true);
  });
});

test('createLinks overwrite policy replaces existing file with symlink', { skip: isWindows }, async () => {
  await withTempDir(async (dirPath) => {
    const binDir = path.join(dirPath, 'bin');
    fs.mkdirSync(binDir, { recursive: true });

    const target = createTargetFile(dirPath, 'cli.js');
    const existingPath = path.join(binDir, 'my-cli');
    fs.writeFileSync(existingPath, 'existing');

    const result = await createLinks({
      bins: new Map([['my-cli', target]]),
      binDir,
      policy: 'overwrite',
    });

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
      () =>
        createLinks({
          bins: new Map([['my-cli', target]]),
          binDir,
          policy: 'fail',
        }),
      /conflicts/,
    );
  });
});

test('createLinks prompt policy respects collision resolver decision', { skip: isWindows }, async () => {
  await withTempDir(async (dirPath) => {
    const binDir = path.join(dirPath, 'bin');
    fs.mkdirSync(binDir, { recursive: true });

    const target = createTargetFile(dirPath, 'cli.js');
    fs.writeFileSync(path.join(binDir, 'my-cli'), 'existing');

    let calls = 0;
    const result = await createLinks({
      bins: new Map([['my-cli', target]]),
      binDir,
      policy: 'prompt',
      collisionResolver: async () => {
        calls += 1;
        return 'overwrite';
      },
    });

    assert.equal(calls, 1);
    assert.equal(result.created.length, 1);
  });
});

test('createLinks prompt policy abort decision throws', { skip: isWindows }, async () => {
  await withTempDir(async (dirPath) => {
    const binDir = path.join(dirPath, 'bin');
    fs.mkdirSync(binDir, { recursive: true });

    const target = createTargetFile(dirPath, 'cli.js');
    fs.writeFileSync(path.join(binDir, 'my-cli'), 'existing');

    await assert.rejects(
      () =>
        createLinks({
          bins: new Map([['my-cli', target]]),
          binDir,
          policy: 'prompt',
          collisionResolver: async () => 'abort',
        }),
      /aborted on collision/,
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

    const result = await createLinks({
      bins: new Map([['my-cli', target]]),
      binDir,
      policy: 'overwrite',
    });

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
      () =>
        createLinks({
          bins: new Map([['my-cli', target]]),
          binDir,
          policy: 'overwrite',
        }),
      /cannot overwrite directory/,
    );
  });
});
