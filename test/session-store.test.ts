import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

import { writeLauncher } from '../src/lib/launchers';
import {
  cleanupLinks,
  cleanupStaleSessions,
  generateSessionFilePath,
  generateSessionRecord,
  ensureSymlxDirectories,
  persistSession,
} from '../src/lib/session-store';
import type { LinkRecord } from '../src/lib/types';

function withTempDir(run: (dirPath: string) => void): void {
  const dirPath = fs.mkdtempSync(path.join(os.tmpdir(), 'symlx-session-test-'));
  try {
    run(dirPath);
  } finally {
    fs.rmSync(dirPath, { recursive: true, force: true });
  }
}

const isWindows = process.platform === 'win32';

function createExecutable(filePath: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, '#!/usr/bin/env node\nconsole.log("ok")\n');
  fs.chmodSync(filePath, 0o755);
}

test('ensureSymlxDirectories creates bin and session directories', () => {
  withTempDir((dirPath) => {
    const binDir = path.join(dirPath, '.symlx', 'bin');
    const sessionDir = path.join(dirPath, '.symlx', 'sessions');

    ensureSymlxDirectories(binDir, sessionDir);

    assert.equal(fs.existsSync(binDir), true);
    assert.equal(fs.existsSync(sessionDir), true);
  });
});

test('cleanupLinks removes tracked direct links when target matches', { skip: isWindows }, () => {
  withTempDir((dirPath) => {
    const target = path.join(dirPath, 'dist', 'cli.js');
    createExecutable(target);

    const linkPath = path.join(dirPath, 'bin', 'my-cli');
    fs.mkdirSync(path.dirname(linkPath), { recursive: true });
    fs.symlinkSync(target, linkPath);

    const links: LinkRecord[] = [
      { name: 'my-cli', linkPath, target, kind: 'direct-link' },
    ];
    cleanupLinks(links);

    assert.equal(fs.existsSync(linkPath), false);
  });
});

test('cleanupLinks does not remove direct links when target mismatch', { skip: isWindows }, () => {
  withTempDir((dirPath) => {
    const expectedTarget = path.join(dirPath, 'dist', 'cli.js');
    const actualTarget = path.join(dirPath, 'dist', 'other.js');
    createExecutable(expectedTarget);
    createExecutable(actualTarget);

    const linkPath = path.join(dirPath, 'bin', 'my-cli');
    fs.mkdirSync(path.dirname(linkPath), { recursive: true });
    fs.symlinkSync(actualTarget, linkPath);

    const links: LinkRecord[] = [
      { name: 'my-cli', linkPath, target: expectedTarget, kind: 'direct-link' },
    ];
    cleanupLinks(links);

    assert.equal(fs.existsSync(linkPath), true);
  });
});

test('cleanupLinks removes tracked launchers when content matches', { skip: isWindows }, () => {
  withTempDir((dirPath) => {
    const target = path.join(dirPath, 'src', 'cli.ts');
    const runtimeCommand = path.join(dirPath, 'node_modules', '.bin', 'tsx');
    createExecutable(runtimeCommand);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, 'console.log("ok")\n');

    const linkPath = path.join(dirPath, 'bin', 'my-cli');
    fs.mkdirSync(path.dirname(linkPath), { recursive: true });
    writeLauncher(linkPath, 'tsx', runtimeCommand, target);

    const links: LinkRecord[] = [
      {
        name: 'my-cli',
        linkPath,
        target,
        kind: 'launcher',
        launcherKind: 'tsx',
        runtimeCommand,
      },
    ];
    cleanupLinks(links);

    assert.equal(fs.existsSync(linkPath), false);
  });
});

test('cleanupLinks does not remove modified launcher files', { skip: isWindows }, () => {
  withTempDir((dirPath) => {
    const target = path.join(dirPath, 'src', 'cli.ts');
    const runtimeCommand = path.join(dirPath, 'node_modules', '.bin', 'tsx');
    createExecutable(runtimeCommand);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, 'console.log("ok")\n');

    const linkPath = path.join(dirPath, 'bin', 'my-cli');
    fs.mkdirSync(path.dirname(linkPath), { recursive: true });
    fs.writeFileSync(linkPath, '#!/usr/bin/env node\nconsole.log("changed")\n');
    fs.chmodSync(linkPath, 0o755);

    const links: LinkRecord[] = [
      {
        name: 'my-cli',
        linkPath,
        target,
        kind: 'launcher',
        launcherKind: 'tsx',
        runtimeCommand,
      },
    ];
    cleanupLinks(links);

    assert.equal(fs.existsSync(linkPath), true);
  });
});

test('cleanupStaleSessions removes stale sessions and non-json files', { skip: isWindows }, () => {
  withTempDir((dirPath) => {
    const sessionDir = path.join(dirPath, '.symlx', 'sessions');
    fs.mkdirSync(sessionDir, { recursive: true });
    fs.writeFileSync(path.join(sessionDir, 'junk.txt'), 'junk');

    const target = path.join(dirPath, 'dist', 'cli.js');
    createExecutable(target);

    const linkPath = path.join(dirPath, 'bin', 'my-cli');
    fs.mkdirSync(path.dirname(linkPath), { recursive: true });
    fs.symlinkSync(target, linkPath);

    const sessionPath = generateSessionFilePath(sessionDir);
    persistSession(sessionPath, {
      pid: -1,
      cwd: dirPath,
      createdAt: new Date().toISOString(),
      links: [{ name: 'my-cli', linkPath, target, kind: 'direct-link' }],
    });

    cleanupStaleSessions(sessionDir);

    assert.equal(fs.existsSync(path.join(sessionDir, 'junk.txt')), false);
    assert.equal(fs.existsSync(sessionPath), false);
    assert.equal(fs.existsSync(linkPath), false);
  });
});

test('cleanupStaleSessions keeps active sessions for live pids', { skip: isWindows }, () => {
  withTempDir((dirPath) => {
    const sessionDir = path.join(dirPath, '.symlx', 'sessions');
    fs.mkdirSync(sessionDir, { recursive: true });

    const target = path.join(dirPath, 'dist', 'cli.js');
    createExecutable(target);

    const linkPath = path.join(dirPath, 'bin', 'my-cli');
    fs.mkdirSync(path.dirname(linkPath), { recursive: true });
    fs.symlinkSync(target, linkPath);

    const sessionPath = generateSessionFilePath(sessionDir);
    persistSession(sessionPath, {
      pid: process.pid,
      cwd: dirPath,
      createdAt: new Date().toISOString(),
      links: [{ name: 'my-cli', linkPath, target, kind: 'direct-link' }],
    });

    cleanupStaleSessions(sessionDir);

    assert.equal(fs.existsSync(sessionPath), true);
    assert.equal(fs.existsSync(linkPath), true);
  });
});

test('generateSessionFilePath creates json path inside session dir', () => {
  withTempDir((dirPath) => {
    const sessionDir = path.join(dirPath, '.symlx', 'sessions');
    const sessionPath = generateSessionFilePath(sessionDir);

    assert.equal(path.dirname(sessionPath), sessionDir);
    assert.match(path.basename(sessionPath), /\.json$/);
  });
});

test('generateSessionRecord uses current pid and provided values', () => {
  const links: LinkRecord[] = [
    { name: 'tool', linkPath: '/tmp/tool', target: '/tmp/cli.js', kind: 'direct-link' },
  ];
  const cwd = '/tmp/project';
  const record = generateSessionRecord(cwd, links);

  assert.equal(record.pid, process.pid);
  assert.equal(record.cwd, cwd);
  assert.deepEqual(record.links, links);
  assert.equal(typeof record.createdAt, 'string');
});
