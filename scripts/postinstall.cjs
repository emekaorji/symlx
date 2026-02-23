#!/usr/bin/env node

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const PREFIX = '[symlx]';
const START = '# >>> symlx path >>>';
const END = '# <<< symlx path <<<';
const BIN_PATH = '$HOME/.symlx/bin';
const PROFILE_BASENAMES = ['.zprofile', '.zshrc', '.bashrc'];

function info(message) {
  process.stdout.write(`${PREFIX} ${message}\n`);
}

function warn(message) {
  process.stderr.write(`${PREFIX} ${message}\n`);
}

function resolveProfilePaths(homeDir) {
  return PROFILE_BASENAMES.map((basename) => path.join(homeDir, basename));
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildPathBlock() {
  return [
    START,
    `if [[ ":$PATH:" != *":${BIN_PATH}:"* ]]; then`,
    `  export PATH="${BIN_PATH}:$PATH"`,
    'fi',
    END,
  ].join('\n');
}

function ensureTrailingNewline(value) {
  return value.endsWith('\n') ? value : `${value}\n`;
}

function upsertProfileBlock(filePath, block) {
  const exists = fs.existsSync(filePath);
  const current = exists ? fs.readFileSync(filePath, 'utf8') : '';
  const normalizedCurrent = current.replace(/\r\n/g, '\n');

  const markerPattern = new RegExp(
    `${escapeRegExp(START)}[\\s\\S]*?${escapeRegExp(END)}\\n?`,
    'm',
  );

  let next;
  if (markerPattern.test(normalizedCurrent)) {
    next = normalizedCurrent.replace(markerPattern, `${block}\n`);
  } else if (normalizedCurrent.trim().length === 0) {
    next = `${block}\n`;
  } else {
    next = `${ensureTrailingNewline(normalizedCurrent)}\n${block}\n`;
  }

  if (next === normalizedCurrent) {
    return false;
  }

  fs.writeFileSync(filePath, next, 'utf8');
  return true;
}

function run() {
  if (process.env.SYMLX_SKIP_PATH_SETUP === '1') {
    info('skipping PATH setup because SYMLX_SKIP_PATH_SETUP=1');
    return;
  }

  if (process.platform === 'win32') {
    info('skipping shell profile PATH setup on Windows');
    return;
  }

  const homeDir = os.homedir();
  if (!homeDir) {
    warn('could not resolve home directory; skipping PATH setup');
    return;
  }

  const block = buildPathBlock();
  const profilePaths = resolveProfilePaths(homeDir);
  const existingPaths = profilePaths.filter((filePath) => fs.existsSync(filePath));
  const targets = existingPaths.length > 0 ? existingPaths : [profilePaths[0]];

  const updated = [];
  for (const target of targets) {
    try {
      const changed = upsertProfileBlock(target, block);
      if (changed) {
        updated.push(target);
      }
    } catch (error) {
      warn(`could not update ${target}: ${String(error)}`);
    }
  }

  if (updated.length > 0) {
    info(`added ${BIN_PATH} to PATH in:`);
    for (const target of updated) {
      info(`- ${target}`);
    }
    info('open a new shell (or source your profile) to apply immediately');
  } else {
    info(`PATH setup already present (${BIN_PATH})`);
  }
}

run();
