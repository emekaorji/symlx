import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

function withTempDir(run: (dirPath: string) => void): void {
  const dirPath = fs.mkdtempSync(path.join(os.tmpdir(), 'symlx-link-command-'));
  try {
    run(dirPath);
  } finally {
    fs.rmSync(dirPath, { recursive: true, force: true });
  }
}

function writeCliTarget(filePath: string, mode: number): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, '#!/usr/bin/env node\nconsole.log("ok")\n');
  fs.chmodSync(filePath, mode);
}

function writeJSON(filePath: string, value: unknown): void {
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2));
}

function runCli(
  args: string[],
  cwd: string,
  homeDirectory?: string,
): ReturnType<typeof spawnSync> {
  const cliPath = path.join(process.cwd(), '.tmp-tests', 'src', 'cli.js');
  const env = { ...process.env };
  if (homeDirectory) {
    env.HOME = homeDirectory;
    env.USERPROFILE = homeDirectory;
  }

  return spawnSync(process.execPath, [cliPath, ...args], {
    cwd,
    env,
    encoding: 'utf8',
  });
}

test('cli help shows the link command', () => {
  const result = runCli(['--help'], process.cwd());
  const stdout = String(result.stdout);

  assert.equal(result.status, 0);
  assert.match(stdout, /\bserve\b/);
  assert.match(stdout, /\blink\b/);
});

const isWindows = process.platform === 'win32';

test(
  'link creates project command links and exits without writing a session record',
  { skip: isWindows },
  () => {
    withTempDir((dirPath) => {
      const homeDirectory = path.join(dirPath, 'home');
      const projectDirectory = path.join(dirPath, 'project');
      fs.mkdirSync(homeDirectory, { recursive: true });
      fs.mkdirSync(projectDirectory, { recursive: true });

      writeJSON(path.join(projectDirectory, 'package.json'), {
        name: 'sample-cli-project',
        bin: {
          'sample-cli': './dist/cli.js',
        },
      });

      writeCliTarget(path.join(projectDirectory, 'dist', 'cli.js'), 0o755);

      const result = runCli(
        ['link', '--collision', 'overwrite'],
        projectDirectory,
        homeDirectory,
      );

      assert.equal(
        result.status,
        0,
        `stdout:\n${result.stdout}\nstderr:\n${result.stderr}`,
      );

      const linkPath = path.join(homeDirectory, '.symlx', 'bin', 'sample-cli');
      assert.equal(fs.lstatSync(linkPath).isSymbolicLink(), true);

      const sessionDirectory = path.join(homeDirectory, '.symlx', 'sessions');
      if (fs.existsSync(sessionDirectory)) {
        const entries = fs.readdirSync(sessionDirectory);
        assert.equal(entries.length, 0);
      }
    });
  },
);

test(
  'link makes non-executable bin targets executable before linking',
  { skip: isWindows },
  () => {
    withTempDir((dirPath) => {
      const homeDirectory = path.join(dirPath, 'home');
      const projectDirectory = path.join(dirPath, 'project');
      const targetPath = path.join(projectDirectory, 'dist', 'cli.js');
      fs.mkdirSync(homeDirectory, { recursive: true });
      fs.mkdirSync(projectDirectory, { recursive: true });

      writeJSON(path.join(projectDirectory, 'package.json'), {
        name: 'sample-cli-project',
        bin: {
          'sample-cli': './dist/cli.js',
        },
      });

      writeCliTarget(targetPath, 0o644);

      const result = runCli(
        ['link', '--collision', 'overwrite'],
        projectDirectory,
        homeDirectory,
      );

      assert.equal(
        result.status,
        0,
        `stdout:\n${result.stdout}\nstderr:\n${result.stderr}`,
      );

      fs.accessSync(targetPath, fs.constants.X_OK);
      const linkPath = path.join(homeDirectory, '.symlx', 'bin', 'sample-cli');
      assert.equal(fs.lstatSync(linkPath).isSymbolicLink(), true);
    });
  },
);
