#!/usr/bin/env node

import { Command } from "commander";

import { runServe } from "./commands/serve";
import type { CollisionPolicy } from "./core/types";
import * as log from "./ui/logger";

const ALLOWED_COLLISIONS = new Set<CollisionPolicy>(["prompt", "skip", "fail", "overwrite"]);

function parseCollisionPolicy(value: string): CollisionPolicy {
  if (!ALLOWED_COLLISIONS.has(value as CollisionPolicy)) {
    throw new Error(`invalid collision policy "${value}". expected: prompt|skip|fail|overwrite`);
  }
  return value as CollisionPolicy;
}

async function main(): Promise<void> {
  const program = new Command();

  program
    .name("zlx")
    .description("Temporary CLI bin linker with lifecycle cleanup")
    .showHelpAfterError();

  program
    .command("serve")
    .description("Link this project's package.json bins until zlx exits")
    .option("--bin-dir <dir>", "target bin directory (default: ~/.zlx/bin)")
    .option("--collision <policy>", "collision mode: prompt|skip|fail|overwrite", "prompt")
    .option("--non-interactive", "disable interactive prompts", false)
    .action(async (options: { binDir?: string; collision: string; nonInteractive: boolean }) => {
      await runServe({
        binDir: options.binDir,
        collision: parseCollisionPolicy(options.collision),
        nonInteractive: options.nonInteractive
      });
    });

  await program.parseAsync(process.argv);
}

main().catch((error) => {
  log.error(String(error));
  process.exit(1);
});
