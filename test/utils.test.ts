import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

import {
  loadConfigFileOptions,
  loadPackageJSONOptions,
  pathContainsDir,
} from '../src/lib/utils';

function withTempDir(run: (dirPath: string) => void): void {
  const dirPath = fs.mkdtempSync(path.join(os.tmpdir(), 'symlx-utils-test-'));
  try {
    run(dirPath);
  } finally {
    fs.rmSync(dirPath, { recursive: true, force: true });
  }
}

function writeJSON(filePath: string, value: unknown): void {
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2));
}

test('loadConfigFileOptions returns empty object when config file is missing', () => {
  withTempDir((dirPath) => {
    assert.deepEqual(loadConfigFileOptions(dirPath), {});
  });
});

test('loadConfigFileOptions throws for invalid config JSON', () => {
  withTempDir((dirPath) => {
    fs.writeFileSync(path.join(dirPath, 'symlx.config.json'), '{"bin":');
    assert.throws(
      () => loadConfigFileOptions(dirPath),
      /invalid symlx\.config\.json/,
    );
  });
});

test('loadConfigFileOptions returns parsed config options', () => {
  withTempDir((dirPath) => {
    writeJSON(path.join(dirPath, 'symlx.config.json'), {
      collision: 'overwrite',
      nonInteractive: true,
    });

    const result = loadConfigFileOptions(dirPath);
    assert.equal(result.options?.collision, 'overwrite');
    assert.equal(result.options?.nonInteractive, true);
  });
});

test('loadPackageJSONOptions reports missing package.json', () => {
  withTempDir((dirPath) => {
    const result = loadPackageJSONOptions(dirPath);
    assert.equal(Object.keys(result.bin).length, 0);
    assert.match(result.issues[0] ?? '', /package\.json not found/);
  });
});

test('loadPackageJSONOptions reports invalid package.json parse issues', () => {
  withTempDir((dirPath) => {
    fs.writeFileSync(path.join(dirPath, 'package.json'), '{"name":"oops",');
    const result = loadPackageJSONOptions(dirPath);

    assert.equal(Object.keys(result.bin).length, 0);
    assert.match(result.issues[0] ?? '', /invalid package\.json/);
  });
});

test('loadPackageJSONOptions infers command from string bin and package name', () => {
  withTempDir((dirPath) => {
    writeJSON(path.join(dirPath, 'package.json'), {
      name: 'my-cli',
      bin: './dist/cli.js',
    });

    const result = loadPackageJSONOptions(dirPath);
    assert.equal(result.bin['my-cli'], './dist/cli.js');
    assert.equal(result.issues.length, 0);
  });
});

test('loadPackageJSONOptions infers command from scoped package name', () => {
  withTempDir((dirPath) => {
    writeJSON(path.join(dirPath, 'package.json'), {
      name: '@scope/my-cli',
      bin: './dist/cli.js',
    });

    const result = loadPackageJSONOptions(dirPath);
    assert.equal(result.bin['my-cli'], './dist/cli.js');
    assert.equal(result.issues.length, 0);
  });
});

test('loadPackageJSONOptions returns issue when string bin has no inferable package name', () => {
  withTempDir((dirPath) => {
    writeJSON(path.join(dirPath, 'package.json'), {
      bin: './dist/cli.js',
    });

    const result = loadPackageJSONOptions(dirPath);
    assert.equal(Object.keys(result.bin).length, 0);
    assert.match(result.issues[0] ?? '', /could not infer name/);
  });
});

test('pathContainsDir matches normalized path entries and handles empty PATH', () => {
  withTempDir((dirPath) => {
    const target = path.join(dirPath, '.symlx', 'bin');
    const currentPath = [
      path.join(dirPath, 'a'),
      `${target}${path.sep}..${path.sep}bin`,
      path.join(dirPath, 'b'),
    ].join(path.delimiter);

    assert.equal(pathContainsDir(currentPath, target), true);
    assert.equal(pathContainsDir(undefined, target), false);
  });
});
