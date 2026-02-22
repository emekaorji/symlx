#!/usr/bin/env node

import { Command } from 'commander';

import { runServe } from './commands/serve';
import { serveOptionsSchema, validate } from './lib/validators';
import * as log from './ui/logger';

async function main(): Promise<void> {
  // Commander orchestrates top-level commands/options and help output.
  const program = new Command();

  program
    .name('symlx')
    .description('Temporary CLI bin linker with lifecycle cleanup')
    .showHelpAfterError();

  program
    .command('serve')
    .description("Link this project's package.json bins until symlx exits")
    .option('--bin-dir <dir>', 'target bin directory (default: ~/.symlx/bin)')
    .option(
      '--collision <policy>',
      'collision mode: prompt|skip|fail|overwrite',
      'prompt',
    )
    .option('--non-interactive', 'disable interactive prompts', false)
    .action(
      async (options: {
        binDir?: string;
        collision: string;
        nonInteractive: boolean;
      }) => {
        const validatedOptions = validate(
          serveOptionsSchema,
          options,
          'serve options',
        );

        // Delegate all runtime behavior to the command module.
        await runServe(validatedOptions);
      },
    );

  await program.parseAsync(process.argv);
}

// Centralized fatal error boundary for command execution.
main().catch((error) => {
  log.error(String(error));
  process.exit(1);
});
