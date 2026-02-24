import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

import {
  cleanupSession,
  cleanupStaleSessions,
  createSessionFilePath,
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

test('cleanupSession removes tracked symlink and session file', { skip: isWindows }, () => {
  withTempDir((dirPath) => {
    const target = path.join(dirPath, 'dist', 'cli.js');
    createExecutable(target);

    const linkPath = path.join(dirPath, 'bin', 'my-cli');
    fs.mkdirSync(path.dirname(linkPath), { recursive: true });
    fs.symlinkSync(target, linkPath);

    const sessionPath = path.join(dirPath, 'sessions', 's1.json');
    fs.mkdirSync(path.dirname(sessionPath), { recursive: true });
    fs.writeFileSync(sessionPath, '{}');

    const links: LinkRecord[] = [{ name: 'my-cli', linkPath, target }];
    cleanupSession(sessionPath, links);

    assert.equal(fs.existsSync(linkPath), false);
    assert.equal(fs.existsSync(sessionPath), false);
  });
});

test('cleanupSession does not remove symlink when target mismatch', { skip: isWindows }, () => {
  withTempDir((dirPath) => {
    const expectedTarget = path.join(dirPath, 'dist', 'cli.js');
    const actualTarget = path.join(dirPath, 'dist', 'other.js');
    createExecutable(expectedTarget);
    createExecutable(actualTarget);

    const linkPath = path.join(dirPath, 'bin', 'my-cli');
    fs.mkdirSync(path.dirname(linkPath), { recursive: true });
    fs.symlinkSync(actualTarget, linkPath);

    const sessionPath = path.join(dirPath, 'sessions', 's1.json');
    fs.mkdirSync(path.dirname(sessionPath), { recursive: true });
    fs.writeFileSync(sessionPath, '{}');

    const links: LinkRecord[] = [
      { name: 'my-cli', linkPath, target: expectedTarget },
    ];
    cleanupSession(sessionPath, links);

    assert.equal(fs.existsSync(linkPath), true);
    assert.equal(fs.existsSync(sessionPath), false);
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

    const sessionPath = createSessionFilePath(sessionDir);
    persistSession(sessionPath, {
      pid: -1,
      cwd: dirPath,
      createdAt: new Date().toISOString(),
      links: [{ name: 'my-cli', linkPath, target }],
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

    const sessionPath = createSessionFilePath(sessionDir);
    persistSession(sessionPath, {
      pid: process.pid,
      cwd: dirPath,
      createdAt: new Date().toISOString(),
      links: [{ name: 'my-cli', linkPath, target }],
    });

    cleanupStaleSessions(sessionDir);

    assert.equal(fs.existsSync(sessionPath), true);
    assert.equal(fs.existsSync(linkPath), true);
  });
});
