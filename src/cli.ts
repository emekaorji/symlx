#!/usr/bin/env node

import { Command } from 'commander';

import * as log from './ui/logger';

import { linkCommand } from './commands/link';
import { serveCommand } from './commands/serve';
import {
  binDirOption,
  binOption,
  binResolutionStrategyOption,
  collisionOption,
  nonInteractiveOption,
} from './options';

async function main(): Promise<void> {
  // Commander orchestrates top-level commands/options and help output.
  const program = new Command();

  program
    .name('symlx')
    .description('Temporary CLI bin linker with lifecycle cleanup')
    .showHelpAfterError();

  program
    .command('serve')
    .description("Link this project's bin commands until symlx exits")
    .option(...binDirOption)
    .option(...collisionOption)
    .option(...binResolutionStrategyOption)
    .option(...nonInteractiveOption)
    .option(...binOption)
    .action(serveCommand);

  program
    .command('link')
    .description("Link this project's bin commands once and exit")
    .option(...binDirOption)
    .option(...collisionOption)
    .option(...binResolutionStrategyOption)
    .option(...nonInteractiveOption)
    .option(...binOption)
    .action(linkCommand);

  await program.parseAsync(process.argv);
}

// Centralized fatal error boundary for command execution.
main().catch((error) => {
  log.error(String(error));
  process.exit(1);
});
