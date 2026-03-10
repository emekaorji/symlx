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

function writeTarget(
  filePath: string,
  {
    content = '#!/usr/bin/env node\nconsole.log("ok")\n',
    mode = 0o755,
  }: {
    content?: string;
    mode?: number;
  } = {},
): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
  fs.chmodSync(filePath, mode);
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

function runCli(
  args: string[],
  cwd: string,
  options: {
    homeDirectory?: string;
    extraEnv?: NodeJS.ProcessEnv;
  } = {},
): ReturnType<typeof spawnSync> {
  const cliPath = path.join(process.cwd(), '.tmp-tests', 'src', 'cli.js');
  const env = { ...process.env, ...(options.extraEnv ?? {}) };
  if (options.homeDirectory) {
    env.HOME = options.homeDirectory;
    env.USERPROFILE = options.homeDirectory;
  }

  return spawnSync(process.execPath, [cliPath, ...args], {
    cwd,
    env,
    encoding: 'utf8',
  });
}

const isWindows = process.platform === 'win32';

test('cli help shows the link command and does not expose shebang toggle flag', () => {
  const result = runCli(['link', '--help'], process.cwd());
  const stdout = String(result.stdout);

  assert.equal(result.status, 0);
  assert.match(stdout, /\blink\b/);
  assert.doesNotMatch(stdout, /--no-require-shebang/);
});

test(
  'link creates direct command entries for shebang-bearing JavaScript targets and exits without writing a session record',
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

      writeTarget(path.join(projectDirectory, 'dist', 'cli.js'));

      const result = runCli(
        ['link', '--collision', 'overwrite'],
        projectDirectory,
        { homeDirectory },
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
  'link uses node launcher by default for JavaScript targets without a shebang',
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

      writeTarget(targetPath, {
        content: 'console.log("ok")\n',
        mode: 0o644,
      });

      const result = runCli(['link', '--collision', 'overwrite'], projectDirectory, {
        homeDirectory,
      });

      assert.equal(
        result.status,
        0,
        `stdout:\n${result.stdout}\nstderr:\n${result.stderr}`,
      );

      const linkPath = path.join(homeDirectory, '.symlx', 'bin', 'sample-cli');
      const stats = fs.lstatSync(linkPath);
      assert.equal(stats.isSymbolicLink(), false);
      assert.equal(stats.isFile(), true);
      fs.accessSync(linkPath, fs.constants.X_OK);
    });
  },
);

test(
  'link makes shebang-bearing JavaScript targets executable before linking',
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

      writeTarget(targetPath, {
        content: '#!/usr/bin/env node\nconsole.log("ok")\n',
        mode: 0o644,
      });

      const result = runCli(
        ['link', '--collision', 'overwrite'],
        projectDirectory,
        { homeDirectory },
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

test(
  'link creates tsx launchers for TypeScript targets without shebang by default',
  { skip: isWindows },
  () => {
    withTempDir((dirPath) => {
      const homeDirectory = path.join(dirPath, 'home');
      const projectDirectory = path.join(dirPath, 'project');
      const argsFile = path.join(dirPath, 'tsx-args.txt');
      const targetPath = path.join(projectDirectory, 'src', 'cli.ts');
      fs.mkdirSync(homeDirectory, { recursive: true });
      fs.mkdirSync(projectDirectory, { recursive: true });
      const expectedProjectPath = fs.realpathSync.native(projectDirectory);

      writeJSON(path.join(projectDirectory, 'package.json'), {
        name: 'sample-cli-project',
        bin: {
          'sample-cli': './src/cli.ts',
        },
      });

      writeTarget(targetPath, {
        content: 'console.log("ok")\n',
        mode: 0o644,
      });
      writeTsxStub(projectDirectory);

      const result = runCli(
        ['link', '--collision', 'overwrite'],
        projectDirectory,
        {
          homeDirectory,
          extraEnv: { SYMLX_TSX_ARGS_FILE: argsFile },
        },
      );

      assert.equal(
        result.status,
        0,
        `stdout:\n${result.stdout}\nstderr:\n${result.stderr}`,
      );

      const linkPath = path.join(homeDirectory, '.symlx', 'bin', 'sample-cli');
      const stats = fs.lstatSync(linkPath);
      assert.equal(stats.isSymbolicLink(), false);
      assert.equal(stats.isFile(), true);
      fs.accessSync(linkPath, fs.constants.X_OK);

      const runResult = spawnSync(linkPath, ['--flag', 'value'], {
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
      assert.deepEqual(capturedArgs, [
        path.join(expectedProjectPath, 'src', 'cli.ts'),
        '--flag',
        'value',
      ]);
    });
  },
);

test(
  'link fails with manual-shebang guidance when a shebang-less target type is not supported yet',
  { skip: isWindows },
  () => {
    withTempDir((dirPath) => {
      const homeDirectory = path.join(dirPath, 'home');
      const projectDirectory = path.join(dirPath, 'project');
      const targetPath = path.join(projectDirectory, 'scripts', 'tool.py');
      fs.mkdirSync(homeDirectory, { recursive: true });
      fs.mkdirSync(projectDirectory, { recursive: true });

      writeJSON(path.join(projectDirectory, 'package.json'), {
        name: 'sample-cli-project',
        bin: {
          tool: './scripts/tool.py',
        },
      });

      writeTarget(targetPath, {
        content: 'print("ok")\n',
        mode: 0o644,
      });

      const result = runCli(['link'], projectDirectory, { homeDirectory });

      assert.equal(result.status, 1);
      assert.match(String(result.stderr), /not supported yet without shebang/);
      assert.match(String(result.stderr), /explicitly specify a shebang/);
    });
  },
);
