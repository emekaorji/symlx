#!/usr/bin/env node

import { Command } from "commander";

import { runServe } from "./commands/serve";
import type { CollisionPolicy } from "./core/types";
import * as log from "./ui/logger";

// Accepted values for --collision.
const ALLOWED_COLLISIONS = new Set<CollisionPolicy>(["prompt", "skip", "fail", "overwrite"]);

// Converts raw CLI input into a validated union type used by the serve command.
function parseCollisionPolicy(value: string): CollisionPolicy {
  if (!ALLOWED_COLLISIONS.has(value as CollisionPolicy)) {
    throw new Error(`invalid collision policy "${value}". expected: prompt|skip|fail|overwrite`);
  }
  return value as CollisionPolicy;
}

async function main(): Promise<void> {
  // Commander orchestrates top-level commands/options and help output.
  const program = new Command();

  program
    .name("symlx")
    .description("Temporary CLI bin linker with lifecycle cleanup")
    .showHelpAfterError();

  program
    .command("serve")
    .description("Link this project's package.json bins until symlx exits")
    .option("--bin-dir <dir>", "target bin directory (default: ~/.symlx/bin)")
    .option("--collision <policy>", "collision mode: prompt|skip|fail|overwrite", "prompt")
    .option("--non-interactive", "disable interactive prompts", false)
    .action(async (options: { binDir?: string; collision: string; nonInteractive: boolean }) => {
      // Delegate all runtime behavior to the command module.
      await runServe({
        binDir: options.binDir,
        collision: parseCollisionPolicy(options.collision),
        nonInteractive: options.nonInteractive
      });
    });

  await program.parseAsync(process.argv);
}

// Centralized fatal error boundary for command execution.
main().catch((error) => {
  log.error(String(error));
  process.exit(1);
});
