import os from 'node:os';
import path from 'node:path';

import * as log from '../ui/logger';

import { prepareBinTargets } from '../lib/bin-targets';
import { PROMPT_FALLBACK_WARNING } from '../lib/constants';
import { createLinks, assertLinksCreated } from '../lib/link-manager';
import { resolveInternalCollisionOption, resolveOptions } from '../lib/options';
import { serveInlineOptionsSchema } from '../lib/schema';
import {
  cleanupStaleSessions,
  ensureSymlxDirectories,
} from '../lib/session-store';
import { printLinkOutcome, printPathHintIfNeeded } from '../ui/serve-output';

export async function linkCommand(inlineOptions: unknown): Promise<void> {
  const cwd = process.cwd();
  const homeDirectory = os.homedir();
  const sessionDir = path.join(homeDirectory, '.symlx', 'sessions');

  const options = resolveOptions(cwd, serveInlineOptionsSchema, inlineOptions);
  const collisionOption = resolveInternalCollisionOption(
    options.collision,
    options.nonInteractive,
  );

  cleanupStaleSessions(sessionDir);
  ensureSymlxDirectories(options.binDir, sessionDir);

  const preparedTargets = prepareBinTargets(cwd, options.bin);

  const linkResult = await createLinks(
    preparedTargets,
    options.binDir,
    collisionOption,
  );
  assertLinksCreated(linkResult);

  if (options.collision === 'prompt' && collisionOption !== 'prompt') {
    log.warn(PROMPT_FALLBACK_WARNING);
  }

  printLinkOutcome(options.binDir, linkResult);
  printPathHintIfNeeded(options.binDir, process.env.PATH);
}
