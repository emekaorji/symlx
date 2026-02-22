import fs from 'node:fs';
import path from 'node:path';

import type {
  CollisionDecision,
  CollisionPolicy,
  LinkConflict,
  LinkCreationResult,
} from '../lib/types';

// Injected prompt/decision hook used only when collision policy is interactive.
export type CollisionResolver = (
  conflict: LinkConflict,
) => Promise<CollisionDecision>;

type ExistingNode = {
  stats: fs.Stats;
  existingTarget?: string;
};

// lstat wrapper that treats missing files as "not found" but rethrows real IO errors.
function tryLstat(filePath: string): fs.Stats | undefined {
  try {
    return fs.lstatSync(filePath);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'ENOENT') {
      return undefined;
    }
    throw error;
  }
}

// Reads an existing command path and resolves the symlink target when possible.
function inspectExistingNode(linkPath: string): ExistingNode | undefined {
  const stats = tryLstat(linkPath);
  if (!stats) {
    return undefined;
  }

  if (!stats.isSymbolicLink()) {
    return { stats };
  }

  try {
    const rawTarget = fs.readlinkSync(linkPath);
    const existingTarget = path.resolve(path.dirname(linkPath), rawTarget);
    return { stats, existingTarget };
  } catch {
    return { stats };
  }
}

// Removes an existing file/symlink to make room for a new command link.
// We do not delete directories to avoid destructive behavior.
function removeExistingNode(linkPath: string, node: ExistingNode): void {
  if (node.stats.isDirectory() && !node.stats.isSymbolicLink()) {
    throw new Error(`cannot overwrite directory at ${linkPath}`);
  }

  fs.unlinkSync(linkPath);
}

// Normalizes filesystem state into a user-facing collision descriptor.
function toConflict(
  name: string,
  linkPath: string,
  target: string,
  node: ExistingNode,
): LinkConflict {
  if (node.stats.isSymbolicLink()) {
    return {
      name,
      linkPath,
      target,
      reason: node.existingTarget
        ? `already linked to ${node.existingTarget}`
        : 'already exists as symlink',
      existingTarget: node.existingTarget,
      isSymlink: true,
    };
  }

  return {
    name,
    linkPath,
    target,
    reason: 'already exists as a file',
    isSymlink: false,
  };
}

// Creates symlinks for all project bins according to the selected collision strategy.
// This function is pure with regard to policy: caller decides interactive vs non-interactive.
export async function createLinks(params: {
  bins: Map<string, string>;
  binDir: string;
  policy: CollisionPolicy;
  collisionResolver?: CollisionResolver;
}): Promise<LinkCreationResult> {
  const { bins, binDir, policy, collisionResolver } = params;
  const created = [];
  const skipped = [];

  for (const [name, target] of bins.entries()) {
    const linkPath = path.join(binDir, name);
    const existingNode = inspectExistingNode(linkPath);

    if (existingNode) {
      const conflict = toConflict(name, linkPath, target, existingNode);

      // Reusing the exact same link is always a no-op.
      if (
        conflict.existingTarget &&
        path.resolve(conflict.existingTarget) === path.resolve(target)
      ) {
        skipped.push({
          name,
          linkPath,
          reason: 'already linked to requested target',
        });
        continue;
      }

      let decision: CollisionDecision;
      if (policy === 'skip') {
        decision = 'skip';
      } else if (policy === 'overwrite') {
        decision = 'overwrite';
      } else if (policy === 'fail') {
        throw new Error(
          `command "${name}" conflicts at ${linkPath}: ${conflict.reason}`,
        );
      } else {
        decision = collisionResolver
          ? await collisionResolver(conflict)
          : 'skip';
      }

      if (decision === 'abort') {
        throw new Error(`aborted on collision for command "${name}"`);
      }

      if (decision === 'skip') {
        skipped.push({ name, linkPath, reason: conflict.reason });
        continue;
      }

      removeExistingNode(linkPath, existingNode);
    }

    fs.symlinkSync(target, linkPath);
    created.push({ name, linkPath, target });
  }

  return { created, skipped };
}
