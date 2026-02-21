import type { CollisionPolicy, SessionRecord } from "../core/types";
import { getZlxPaths, pathContainsDir } from "../core/paths";
import { createLinks } from "../services/link-manager";
import { registerLifecycleCleanup } from "../services/lifecycle";
import { readBins } from "../services/package-bins";
import {
  cleanupSession,
  cleanupStaleSessions,
  createSessionFilePath,
  ensureZlxDirectories,
  persistSession
} from "../services/session-store";
import { promptCollisionDecision } from "../ui/collision-prompt";
import * as log from "../ui/logger";

// Options normalized by the command layer before entering the core serve workflow.
export type ServeOptions = {
  binDir?: string;
  collision: CollisionPolicy;
  nonInteractive: boolean;
};

// Prompts require an interactive terminal; scripts/CI should avoid prompt mode.
function isInteractiveSession(): boolean {
  return Boolean(process.stdin.isTTY && process.stdout.isTTY);
}

// Main zlx behavior:
// 1) resolve bins from package.json
// 2) create links
// 3) persist session
// 4) keep process alive and cleanup on exit
export async function runServe(options: ServeOptions): Promise<void> {
  const cwd = process.cwd();
  const paths = getZlxPaths(options.binDir);

  // Prepare runtime directories and recover stale sessions from previous abnormal exits.
  ensureZlxDirectories(paths.binDir, paths.sessionDir);
  cleanupStaleSessions(paths.sessionDir);

  const bins = readBins(cwd);

  // Prompt policy only works when we can interact with a TTY.
  const usePrompts = options.collision === "prompt" && !options.nonInteractive && isInteractiveSession();
  if (options.collision === "prompt" && !usePrompts) {
    log.warn("prompt collision mode requested but session is non-interactive; falling back to skip");
  }

  // Link creation returns both successful links and explicit skips.
  const linkResult = await createLinks({
    bins,
    binDir: paths.binDir,
    policy: options.collision,
    collisionResolver: usePrompts ? promptCollisionDecision : undefined
  });

  if (linkResult.created.length === 0) {
    throw new Error("no links were created");
  }

  // Session file is the source of truth for cleaning this exact run's links.
  const sessionPath = createSessionFilePath(paths.sessionDir);
  const sessionRecord: SessionRecord = {
    pid: process.pid,
    cwd,
    createdAt: new Date().toISOString(),
    links: linkResult.created
  };
  persistSession(sessionPath, sessionRecord);

  // Always cleanup linked commands when this process leaves.
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

  // Keep process alive indefinitely; lifecycle handlers handle termination and cleanup.
  await new Promise<void>(() => {
    setInterval(() => undefined, 60_000);
  });
}
