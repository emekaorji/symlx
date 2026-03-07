import os from 'node:os';
import path from 'node:path';

import * as log from '../ui/logger';

import { printLinkOutcome, printPathHintIfNeeded } from '../ui/serve-output';
import { resolveInternalCollisionOption, resolveOptions } from '../lib/options';
import { serveInlineOptionsSchema } from '../lib/schema';
import { prepareBinTargets } from '../lib/bin-targets';
import { createLinks, assertLinksCreated } from '../lib/link-manager';
import {
  cleanupStaleSessions,
  ensureSymlxDirectories,
} from '../lib/session-store';
import { PROMPT_FALLBACK_WARNING } from '../lib/constants';

export async function linkCommand(inlineOptions: unknown): Promise<void> {
  const cwd = process.cwd();
  const homeDirectory = os.homedir();
  const sessionDir = path.join(homeDirectory, '.symlx', 'sessions');

  const options = resolveOptions(cwd, serveInlineOptionsSchema, inlineOptions);
  const internalCollisionOption = resolveInternalCollisionOption(
    options.collision,
    options.nonInteractive,
  );

  cleanupStaleSessions(sessionDir);
  ensureSymlxDirectories(options.binDir, sessionDir);
  prepareBinTargets(options.bin);

  const linkResult = await createLinks(
    options.bin,
    options.binDir,
    internalCollisionOption,
  );
  assertLinksCreated(linkResult);

  if (options.collision === 'prompt' && internalCollisionOption !== 'prompt') {
    log.warn(PROMPT_FALLBACK_WARNING);
  }
  printLinkOutcome(options.binDir, linkResult);
  printPathHintIfNeeded(options.binDir, process.env.PATH);
}
