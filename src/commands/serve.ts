import path from 'path';
import os from 'node:os';

import * as log from '../ui/logger';

import { pathContainsDir } from '../lib/utils';
import { createLinks } from '../lib/link-manager';
import { registerLifecycleCleanup } from '../lib/lifecycle';
import {
  cleanupSession,
  cleanupStaleSessions,
  createSessionFilePath,
  ensureSymlxDirectories,
  persistSession,
} from '../lib/session-store';
import { promptCollisionDecision } from '../ui/collision-prompt';
import { resolveOptions } from '../lib/options';
import { serveInlineOptionsSchema } from '../lib/schema';

import type { Options } from '../lib/schema';
import type { SessionRecord } from '../lib/types';

// Prompts require an interactive terminal; scripts/CI should avoid prompt mode.
function isInteractiveSession(): boolean {
  return Boolean(process.stdin.isTTY && process.stdout.isTTY);
}

// Main symlx behavior:
// 1) resolve bins from package.json
// 2) create links
// 3) persist session
// 4) keep process alive and cleanup on exit
async function run(options: Options): Promise<void> {
  const cwd = process.cwd();
  const sessionDir = path.join(os.homedir(), '.symlx', 'sessions');

  // Prepare runtime directories and recover stale sessions from previous abnormal exits.
  cleanupStaleSessions(sessionDir);
  ensureSymlxDirectories(options.binDir, sessionDir);

  const bins = new Map(Object.entries(options.bin));

  // Prompt policy only works when we can interact with a TTY.
  const usePrompts =
    options.collision === 'prompt' &&
    !options.nonInteractive &&
    isInteractiveSession();
  if (options.collision === 'prompt' && !usePrompts) {
    log.warn(
      'prompt collision mode requested but session is non-interactive; falling back to skip',
    );
  }

  // Link creation returns both successful links and explicit skips.
  const linkResult = await createLinks({
    bins,
    binDir: options.binDir,
    policy: options.collision,
    collisionResolver: usePrompts ? promptCollisionDecision : undefined,
  });

  if (linkResult.created.length === 0) {
    throw new Error('no links were created');
  }

  // Session file is the source of truth for cleaning this exact run's links.
  const sessionPath = createSessionFilePath(sessionDir);
  const sessionRecord: SessionRecord = {
    pid: process.pid,
    cwd,
    createdAt: new Date().toISOString(),
    links: linkResult.created,
  };
  persistSession(sessionPath, sessionRecord);

  // Always cleanup linked commands when this process leaves.
  registerLifecycleCleanup(() => {
    cleanupSession(sessionPath, sessionRecord.links);
  });

  log.info(
    `linked ${linkResult.created.length} command(s) into ${options.binDir}`,
  );
  for (const link of linkResult.created) {
    log.info(`${link.name} -> ${link.target}`);
  }

  for (const skip of linkResult.skipped) {
    log.warn(`skip "${skip.name}": ${skip.reason} (${skip.linkPath})`);
  }

  if (!pathContainsDir(process.env.PATH, options.binDir)) {
    log.info(
      `add this to your shell config if needed:\nexport PATH="${options.binDir}:$PATH"`,
    );
  }

  log.info('running. press Ctrl+C to cleanup links.');

  // Keep process alive indefinitely; lifecycle handlers handle termination and cleanup.
  await new Promise<void>(() => {
    setInterval(() => undefined, 60_000);
  });
}

export function serveCommand(inlineOptions: unknown) {
  const cwd = process.cwd();
  const options = resolveOptions(cwd, serveInlineOptionsSchema, inlineOptions);

  return run(options);
}
