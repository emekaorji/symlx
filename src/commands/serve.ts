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
import { promptCollisionDecision } from '../ui/prompts';
import { resolveOptions } from '../lib/options';
import { serveInlineOptionsSchema } from '../lib/schema';

import type { Options } from '../lib/schema';
import type { SessionRecord } from '../lib/types';
import type { LinkCreationResult } from '../lib/types';
import type { CollisionResolver } from '../lib/link-manager';

// Prompts require an interactive terminal; scripts/CI should avoid prompt mode.
function isInteractiveSession(): boolean {
  return Boolean(process.stdin.isTTY && process.stdout.isTTY);
}

type CollisionHandling = {
  policy: Options['collision'];
  collisionResolver?: CollisionResolver;
};

function prepareRuntimeDirectories(binDir: string, sessionDir: string): void {
  cleanupStaleSessions(sessionDir);
  ensureSymlxDirectories(binDir, sessionDir);
}

function resolveCollisionHandling(options: Options): CollisionHandling {
  if (options.collision !== 'prompt') {
    return { policy: options.collision };
  }

  const canPrompt = !options.nonInteractive && isInteractiveSession();
  if (!canPrompt) {
    log.warn(
      'prompt collision mode requested but session is non-interactive; falling back to skip',
    );
    return { policy: 'skip' };
  }

  return {
    policy: 'prompt',
    collisionResolver: promptCollisionDecision,
  };
}

async function linkCommands(
  options: Options,
  collisionHandling: CollisionHandling,
): Promise<LinkCreationResult> {
  return createLinks({
    bins: new Map(Object.entries(options.bin)),
    binDir: options.binDir,
    policy: collisionHandling.policy,
    collisionResolver: collisionHandling.collisionResolver,
  });
}

function ensureLinksWereCreated(linkResult: LinkCreationResult): void {
  if (linkResult.created.length === 0) {
    throw new Error('no links were created');
  }
}

function persistActiveSession(params: {
  sessionDir: string;
  cwd: string;
  links: SessionRecord['links'];
}): { sessionPath: string; sessionRecord: SessionRecord } {
  const { sessionDir, cwd, links } = params;

  const sessionPath = createSessionFilePath(sessionDir);
  const sessionRecord: SessionRecord = {
    pid: process.pid,
    cwd,
    createdAt: new Date().toISOString(),
    links,
  };

  persistSession(sessionPath, sessionRecord);

  return { sessionPath, sessionRecord };
}

function registerSessionCleanup(
  sessionPath: string,
  links: SessionRecord['links'],
): void {
  registerLifecycleCleanup(() => {
    cleanupSession(sessionPath, links);
  });
}

function printLinkOutcome(binDir: string, linkResult: LinkCreationResult): void {
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

function printPathHintIfNeeded(binDir: string): void {
  if (pathContainsDir(process.env.PATH, binDir)) {
    return;
  }

  log.info(
    `add this to your shell config if needed:\nexport PATH="${binDir}:$PATH"`,
  );
}

function waitIndefinitely(): Promise<void> {
  return new Promise<void>(() => {
    setInterval(() => undefined, 60_000);
  });
}

async function run(options: Options): Promise<void> {
  const cwd = process.cwd();
  const sessionDir = path.join(os.homedir(), '.symlx', 'sessions');

  prepareRuntimeDirectories(options.binDir, sessionDir);

  const collisionHandling = resolveCollisionHandling(options);
  const linkResult = await linkCommands(options, collisionHandling);

  ensureLinksWereCreated(linkResult);

  const { sessionPath, sessionRecord } = persistActiveSession({
    sessionDir,
    cwd,
    links: linkResult.created,
  });

  registerSessionCleanup(sessionPath, sessionRecord.links);
  printLinkOutcome(options.binDir, linkResult);
  printPathHintIfNeeded(options.binDir);

  log.info('running. press Ctrl+C to cleanup links.');

  await waitIndefinitely();
}

export function serveCommand(inlineOptions: unknown) {
  const cwd = process.cwd();
  const options = resolveOptions(cwd, serveInlineOptionsSchema, inlineOptions);

  return run(options);
}
