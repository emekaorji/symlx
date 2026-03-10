import assert from 'node:assert/strict';
import { once } from 'node:events';
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { test } from 'node:test';

function withTempDir(run: (dirPath: string) => Promise<void> | void): Promise<void> {
  const dirPath = fs.mkdtempSync(path.join(os.tmpdir(), 'symlx-serve-command-'));
  return Promise.resolve(run(dirPath)).finally(() => {
    fs.rmSync(dirPath, { recursive: true, force: true });
  });
}

function writeTarget(filePath: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, 'console.log("ok")\n');
  fs.chmodSync(filePath, 0o644);
}

function writeTsxStub(projectDirectory: string): string {
  const tsxPath = path.join(projectDirectory, 'node_modules', '.bin', 'tsx');
  fs.mkdirSync(path.dirname(tsxPath), { recursive: true });
  fs.writeFileSync(
    tsxPath,
    '#!/bin/sh\nprintf "%s\\n" "$@" > "$SYMLX_TSX_ARGS_FILE"\nexit 0\n',
  );
  fs.chmodSync(tsxPath, 0o755);
  return tsxPath;
}

function writeJSON(filePath: string, value: unknown): void {
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2));
}

async function waitFor(
  predicate: () => boolean,
  timeoutMs = 5_000,
): Promise<void> {
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    if (predicate()) {
      return;
    }
    await delay(50);
  }

  throw new Error('timed out waiting for condition');
}

const isWindows = process.platform === 'win32';

test(
  'serve keeps TypeScript command launchers active and cleans them up on exit',
  { skip: isWindows },
  async () => {
    await withTempDir(async (dirPath) => {
      const homeDirectory = path.join(dirPath, 'home');
      const projectDirectory = path.join(dirPath, 'project');
      const argsFile = path.join(dirPath, 'tsx-args.txt');
      const targetPath = path.join(projectDirectory, 'src', 'cli.ts');
      fs.mkdirSync(homeDirectory, { recursive: true });
      fs.mkdirSync(projectDirectory, { recursive: true });
      const expectedTargetPath = fs.realpathSync.native(projectDirectory);

      writeJSON(path.join(projectDirectory, 'package.json'), {
        name: 'sample-cli-project',
        bin: {
          'sample-cli': './src/cli.ts',
        },
      });

      writeTarget(targetPath);
      writeTsxStub(projectDirectory);

      const cliPath = path.join(process.cwd(), '.tmp-tests', 'src', 'cli.js');
      const child = spawn(process.execPath, [cliPath, 'serve', '--collision', 'overwrite'], {
        cwd: projectDirectory,
        env: {
          ...process.env,
          HOME: homeDirectory,
          USERPROFILE: homeDirectory,
          SYMLX_TSX_ARGS_FILE: argsFile,
        },
        stdio: 'pipe',
      });

      const linkPath = path.join(homeDirectory, '.symlx', 'bin', 'sample-cli');
      await waitFor(() => fs.existsSync(linkPath));

      const stats = fs.lstatSync(linkPath);
      assert.equal(stats.isSymbolicLink(), false);
      assert.equal(stats.isFile(), true);

      const runResult = spawnSync(linkPath, ['--help'], {
        env: {
          ...process.env,
          SYMLX_TSX_ARGS_FILE: argsFile,
        },
        encoding: 'utf8',
      });
      assert.equal(
        runResult.status,
        0,
        `stdout:\n${runResult.stdout}\nstderr:\n${runResult.stderr}`,
      );

      const capturedArgs = fs
        .readFileSync(argsFile, 'utf8')
        .trim()
        .split('\n');
      assert.deepEqual(capturedArgs, [path.join(expectedTargetPath, 'src', 'cli.ts'), '--help']);

      child.kill('SIGTERM');
      await once(child, 'exit');
      await waitFor(() => !fs.existsSync(linkPath));
    });
  },
);
