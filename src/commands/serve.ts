import os from 'node:os';
import path from 'node:path';

import * as log from '../ui/logger';

import { printLinkOutcome, printPathHintIfNeeded } from '../ui/serve-output';
import { resolveInternalCollisionOption, resolveOptions } from '../lib/options';
import { serveInlineOptionsSchema } from '../lib/schema';
import { prepareBinTargets } from '../lib/bin-targets';
import { createLinks, assertLinksCreated } from '../lib/link-manager';
import {
  registerLifecycleSessionCleanup,
  cleanupStaleSessions,
  generateSessionFilePath,
  ensureSymlxDirectories,
  persistSession,
  generateSessionRecord,
} from '../lib/session-store';
import { PROMPT_FALLBACK_WARNING } from '../lib/constants';

function waitUntilStopped() {
  return new Promise<void>(() => {
    setInterval(() => undefined, 60_000);
  });
}

export async function serveCommand(inlineOptions: unknown): Promise<void> {
  const cwd = process.cwd();
  const homeDirectory = os.homedir();
  const sessionDir = path.join(homeDirectory, '.symlx', 'sessions');

  // resolve options by merge or otherwise and resolve collision based on interactiveness
  const options = resolveOptions(cwd, serveInlineOptionsSchema, inlineOptions);
  const internalCollisionOption = resolveInternalCollisionOption(
    options.collision,
    options.nonInteractive,
  );

  // prepare
  cleanupStaleSessions(sessionDir);
  ensureSymlxDirectories(options.binDir, sessionDir);
  prepareBinTargets(options.bin);

  // link creation
  const linkResult = await createLinks(
    options.bin,
    options.binDir,
    internalCollisionOption,
  );
  assertLinksCreated(linkResult);

  // session management
  const sessionPath = generateSessionFilePath(sessionDir);
  const sessionRecord = generateSessionRecord(cwd, linkResult.created);
  persistSession(sessionPath, sessionRecord);
  registerLifecycleSessionCleanup(sessionPath, sessionRecord.links);

  // logs
  if (options.collision === 'prompt' && internalCollisionOption !== 'prompt') {
    log.warn(PROMPT_FALLBACK_WARNING);
  }
  printLinkOutcome(options.binDir, linkResult);
  printPathHintIfNeeded(options.binDir, process.env.PATH);
  log.info('running. press Ctrl+C to cleanup links.');

  await waitUntilStopped();
}
