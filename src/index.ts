#!/usr/bin/env node
import { Command } from 'commander';
import { registerAuthCommands } from './commands/auth/login.js';
import { registerIssueCommands } from './commands/issue/index.js';
import { registerPrCommands } from './commands/pr/index.js';
import { registerSearchCommands } from './commands/search/index.js';
import { AzdError } from './errors/index.js';

const program = new Command();

program
  .name('azd')
  .description('Azure DevOps CLI — compatible with GitHub CLI conventions')
  .version('0.1.0');

registerAuthCommands(program);
registerIssueCommands(program);
registerPrCommands(program);
registerSearchCommands(program);

// Unknown command handler
program.on('command:*', function (this: Command) {
  const args = (this as unknown as { args: string[] }).args;
  process.stderr.write(
    `azd: '${args.join(' ')}' is not a valid command.\nSee 'azd --help' for available commands.\n`
  );
  process.exit(1);
});

// Global error handler
process.on('unhandledRejection', (reason: unknown) => {
  if (reason instanceof AzdError) {
    process.stderr.write(`azd: ${reason.message}\n`);
    process.exit(reason.exitCode);
  } else if (reason instanceof Error) {
    process.stderr.write(`azd: ${reason.message}\n`);
    process.exit(1);
  } else {
    process.stderr.write(`azd: unexpected error: ${String(reason)}\n`);
    process.exit(1);
  }
});

program.parseAsync(process.argv).catch((err: unknown) => {
  if (err instanceof AzdError) {
    process.stderr.write(`azd: ${err.message}\n`);
    process.exit(err.exitCode);
  } else if (err instanceof Error) {
    process.stderr.write(`azd: ${err.message}\n`);
    process.exit(1);
  }
});
