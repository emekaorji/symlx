import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

import { resolveOptions } from '../src/lib/options';
import { serveInlineOptionsSchema } from '../src/lib/schema';

function withTempProject(
  setup: (dirPath: string) => void,
  run: (dirPath: string) => void,
): void {
  const dirPath = fs.mkdtempSync(path.join(os.tmpdir(), 'symlx-options-test-'));

  try {
    setup(dirPath);
    run(dirPath);
  } finally {
    fs.rmSync(dirPath, { recursive: true, force: true });
  }
}

function writeJSON(filePath: string, value: unknown): void {
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2));
}

test('replace strategy prefers inline bin over config and package.json', () => {
  withTempProject(
    (dirPath) => {
      writeJSON(path.join(dirPath, 'package.json'), {
        name: 'replace-test',
        bin: {
          'pkg-tool': './dist/pkg.js',
        },
      });

      writeJSON(path.join(dirPath, 'symlx.config.json'), {
        bin: {
          'cfg-tool': './dist/cfg.js',
        },
      });
    },
    (dirPath) => {
      const options = resolveOptions(dirPath, serveInlineOptionsSchema, {
        bin: ['inline-tool=dist/inline.js'],
      });

      assert.deepEqual(Object.keys(options.bin).sort(), ['inline-tool']);
      assert.equal(
        options.bin['inline-tool'],
        path.resolve(dirPath, 'dist/inline.js'),
      );
    },
  );
});

test('merge strategy combines package.json, config, and inline bins', () => {
  withTempProject(
    (dirPath) => {
      writeJSON(path.join(dirPath, 'package.json'), {
        name: 'merge-test',
        bin: {
          'pkg-tool': './dist/pkg.js',
        },
      });

      writeJSON(path.join(dirPath, 'symlx.config.json'), {
        binResolutionStrategy: 'merge',
        bin: {
          'cfg-tool': './dist/cfg.js',
        },
      });
    },
    (dirPath) => {
      const options = resolveOptions(dirPath, serveInlineOptionsSchema, {
        bin: ['inline-tool=dist/inline.js'],
      });

      assert.deepEqual(Object.keys(options.bin).sort(), [
        'cfg-tool',
        'inline-tool',
        'pkg-tool',
      ]);
    },
  );
});

test('invalid package.json produces a targeted error message', () => {
  withTempProject(
    (dirPath) => {
      fs.writeFileSync(path.join(dirPath, 'package.json'), '{"name":"oops",');
    },
    (dirPath) => {
      assert.throws(
        () => resolveOptions(dirPath, serveInlineOptionsSchema, {}),
        /invalid package\.json/,
      );
    },
  );
});
