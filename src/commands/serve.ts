import type { CollisionPolicy, SessionRecord } from "../core/types";
import { getZlxPaths, pathContainsDir } from "../core/paths";
import { createLinks } from "../services/link-manager";
import { registerLifecycleCleanup } from "../services/lifecycle";
import { readBins } from "../services/package-bins";
import {
  cleanupSession,
  cleanupStaleSessions,
  createSessionFilePath,
  ensureCxDirectories,
  persistSession
} from "../services/session-store";
import { promptCollisionDecision } from "../ui/collision-prompt";
import * as log from "../ui/logger";

export type ServeOptions = {
  binDir?: string;
  collision: CollisionPolicy;
  nonInteractive: boolean;
};

function isInteractiveSession(): boolean {
  return Boolean(process.stdin.isTTY && process.stdout.isTTY);
}

export async function runServe(options: ServeOptions): Promise<void> {
  const cwd = process.cwd();
  const paths = getZlxPaths(options.binDir);

  ensureCxDirectories(paths.binDir, paths.sessionDir);
  cleanupStaleSessions(paths.sessionDir);

  const bins = readBins(cwd);

  const usePrompts = options.collision === "prompt" && !options.nonInteractive && isInteractiveSession();
  if (options.collision === "prompt" && !usePrompts) {
    log.warn("prompt collision mode requested but session is non-interactive; falling back to skip");
  }

  const linkResult = await createLinks({
    bins,
    binDir: paths.binDir,
    policy: options.collision,
    collisionResolver: usePrompts ? promptCollisionDecision : undefined
  });

  if (linkResult.created.length === 0) {
    throw new Error("no links were created");
  }

  const sessionPath = createSessionFilePath(paths.sessionDir);
  const sessionRecord: SessionRecord = {
    pid: process.pid,
    cwd,
    createdAt: new Date().toISOString(),
    links: linkResult.created
  };
  persistSession(sessionPath, sessionRecord);

  registerLifecycleCleanup(() => {
    cleanupSession(sessionPath, sessionRecord.links);
  });

  log.info(`linked ${linkResult.created.length} command(s) into ${paths.binDir}`);
  for (const link of linkResult.created) {
    log.info(`${link.name} -> ${link.target}`);
  }

  for (const skip of linkResult.skipped) {
    log.warn(`skip "${skip.name}": ${skip.reason} (${skip.linkPath})`);
  }

  if (!pathContainsDir(process.env.PATH, paths.binDir)) {
    log.info(`add this to your shell config if needed:\nexport PATH="${paths.binDir}:$PATH"`);
  }

  log.info("running. press Ctrl+C to cleanup links.");

  await new Promise<void>(() => {
    setInterval(() => undefined, 60_000);
  });
}
