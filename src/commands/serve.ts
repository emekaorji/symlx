import os from 'node:os';
import path from 'node:path';

import * as log from '../ui/logger';

import { printLinkOutcome, printPathHintIfNeeded } from '../ui/serve-output';
import { resolveInternalCollisionOption, resolveOptions } from '../lib/options';
import { serveInlineOptionsSchema } from '../lib/schema';

import { assertValidBinTargets } from '../lib/bin-targets';
import { createLinks } from '../lib/link-manager';
import {
  registerLifecycleSessionCleanup,
  cleanupStaleSessions,
  generateSessionFilePath,
  ensureSymlxDirectories,
  persistSession,
  generateSessionRecord,
} from '../lib/session-store';

import type { LinkCreationResult } from '../lib/types';

const PROMPT_FALLBACK_WARNING =
  'prompt collision mode requested but session is non-interactive; falling back to skip (use --collision overwrite|fail to avoid skips)';

function waitUntilStopped() {
  return new Promise<void>(() => {
    setInterval(() => undefined, 60_000);
  });
}

function assertLinksCreated(linkResult: LinkCreationResult): void {
  if (linkResult.created.length > 0) {
    return;
  }

  if (linkResult.skipped.length === 0) {
    throw new Error('no links were created');
  }

  const details = linkResult.skipped
    .slice(0, 5)
    .map((skip) => `- ${skip.name}: ${skip.reason}`)
    .join('\n');
  const remainingCount = linkResult.skipped.length - 5;
  const remaining =
    remainingCount > 0 ? `\n- ...and ${remainingCount} more` : '';

  throw new Error(
    [
      'no links were created because all candidate commands were skipped.',
      details,
      `${remaining}\nuse --collision overwrite or --collision fail for stricter behavior.`,
    ].join('\n'),
  );
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
  assertValidBinTargets(options.bin);

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
