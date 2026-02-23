#!/usr/bin/env node

import { Command } from 'commander';

import * as log from './ui/logger';
import { serveCommand } from './commands/serve';

function collectBinEntry(value: string, previous: string[] = []): string[] {
  previous.push(value);
  return previous;
}

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
    .option(
      '--bin <name=path>',
      'custom bin mapping (repeatable), e.g. --bin my-cli=./cli.js',
      collectBinEntry,
      [],
    )
    .action(serveCommand);

  await program.parseAsync(process.argv);
}

// Centralized fatal error boundary for command execution.
main().catch((error) => {
  log.error(String(error));
  process.exit(1);
});
