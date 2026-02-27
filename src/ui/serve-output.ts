import { pathContainsDir } from '../lib/utils';

import * as log from './logger';

import type { LinkCreationResult } from '../lib/types';

export function printLinkOutcome(
  binDir: string,
  linkResult: LinkCreationResult,
): void {
  const createdLinks = linkResult.created;
  log.info(
    `linked ${createdLinks.length} command${createdLinks.length > 1 ? 's' : ''} into ${binDir}`,
  );

  for (const link of createdLinks) {
    log.info(`${link.name} -> ${link.target}`);
  }

  for (const skip of linkResult.skipped) {
    log.warn(`skip "${skip.name}": ${skip.reason} (${skip.linkPath})`);
  }
}

export function printPathHintIfNeeded(
  binDir: string,
  currentPath: string | undefined,
): void {
  if (pathContainsDir(currentPath, binDir)) {
    return;
  }

  log.info(
    `add this to your shell config if needed:\nexport PATH="${binDir}:$PATH"`,
  );
}
