import fs from 'node:fs';
import path from 'node:path';

import type {
  CollisionDecision,
  LinkConflict,
  LinkCreationResult,
  LinkRecord,
  PreparedBinTarget,
} from './types';
import { CollisionOption } from './schema';
import { matchesTsxLauncher, writeTsxLauncher } from './tsx-runtime';
import { promptCollisionResolver } from '../ui/prompts';

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

function matchesPreparedTarget(
  linkPath: string,
  entry: PreparedBinTarget,
  existingNode: ExistingNode,
): boolean {
  if (entry.kind === 'symlink') {
    return Boolean(
      existingNode.existingTarget &&
        path.resolve(existingNode.existingTarget) === path.resolve(entry.target),
    );
  }

  if (existingNode.stats.isSymbolicLink() || !existingNode.stats.isFile()) {
    return false;
  }

  return matchesTsxLauncher(linkPath, entry.runtimeCommand, entry.target);
}

function createCommandEntry(linkPath: string, entry: PreparedBinTarget): LinkRecord {
  if (entry.kind === 'symlink') {
    fs.symlinkSync(entry.target, linkPath);
    return {
      name: entry.name,
      linkPath,
      target: entry.target,
      kind: 'symlink',
    };
  }

  writeTsxLauncher(linkPath, entry.runtimeCommand, entry.target);
  return {
    name: entry.name,
    linkPath,
    target: entry.target,
    kind: 'tsx-launcher',
    runtimeCommand: entry.runtimeCommand,
  };
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

// Creates command entries for all prepared bins according to the selected collision strategy.
// This function is pure with regard to policy: caller decides interactive vs non-interactive.
export async function createLinks(
  preparedTargets: PreparedBinTarget[],
  binDir: string,
  collisionOption: CollisionOption,
): Promise<LinkCreationResult> {
  const created = [];
  const skipped = [];

  for (const entry of preparedTargets) {
    const linkPath = path.join(binDir, entry.name);
    const existingNode = inspectExistingNode(linkPath);

    if (existingNode) {
      const conflict = toConflict(entry.name, linkPath, entry.target, existingNode);

      if (matchesPreparedTarget(linkPath, entry, existingNode)) {
        skipped.push({
          name: entry.name,
          linkPath,
          reason: 'already linked to requested target',
        });
        continue;
      }

      if (collisionOption === 'fail') {
        throw new Error(
          `command "${entry.name}" conflicts at ${linkPath}: ${conflict.reason}`,
        );
      }

      let collisionDecision: CollisionDecision;
      if (collisionOption === 'prompt') {
        collisionDecision = await promptCollisionResolver(conflict);
        if (collisionDecision === 'abort') {
          throw new Error(`aborted on collision for command "${entry.name}"`);
        }
      } else {
        collisionDecision = collisionOption;
      }

      if (collisionDecision === 'skip') {
        skipped.push({ name: entry.name, linkPath, reason: conflict.reason });
        continue;
      }

      removeExistingNode(linkPath, existingNode);
    }

    created.push(createCommandEntry(linkPath, entry));
  }

  return { created, skipped };
}

export function assertLinksCreated(linkResult: LinkCreationResult): void {
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
