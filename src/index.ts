#!/usr/bin/env node

// Suppress DEP0169 ("url.parse() is not standardized") emitted by azure-devops-node-api's
// VsoClient, which calls url.resolve() internally.  This is a third-party issue tracked at:
//   https://github.com/microsoft/azure-devops-node-api/issues/664
// A fix has been submitted in PR https://github.com/microsoft/azure-devops-node-api/pull/662.
// Once that PR is merged and released, this workaround can be removed.
const _emit = process.emit.bind(process) as (...args: unknown[]) => boolean;
(process.emit as unknown) = function (event: string | symbol, ...args: unknown[]): boolean {
  if (event === 'warning' && (args[0] as { code?: string })?.code === 'DEP0169') return false;
  return _emit(event, ...args);
};

import { Command } from 'commander';
import { registerAuthCommands } from './commands/auth/login.js';
import { registerIssueCommands } from './commands/issue/index.js';
import { registerPrCommands } from './commands/pr/index.js';
import { registerSearchCommands } from './commands/search/index.js';
import { registerRepoCommands } from './commands/repo/index.js';
import { registerRunCommands } from './commands/run/index.js';
import { registerCompletionCommand } from './commands/completion.js';
import { registerTeamCommands } from './commands/team/index.js';
import { registerUpdateCommand } from './commands/update.js';
import { AdoError } from './errors/index.js';
import { version } from '../package.json';

const program = new Command();

program
  .name('ado')
  .description('Azure DevOps CLI — compatible with GitHub CLI conventions')
  .version(version);

registerAuthCommands(program);
registerIssueCommands(program);
registerPrCommands(program);
registerSearchCommands(program);
registerRepoCommands(program);
registerRunCommands(program);
registerTeamCommands(program);
registerCompletionCommand(program);
registerUpdateCommand(program);

// Unknown command handler
program.on('command:*', function (this: Command) {
  const args = (this as unknown as { args: string[] }).args;
  process.stderr.write(
    `ado: '${args.join(' ')}' is not a valid command.\nSee 'ado --help' for available commands.\n`
  );
  process.exit(1);
});

// Global error handler
process.on('unhandledRejection', (reason: unknown) => {
  if (reason instanceof AdoError) {
    process.stderr.write(`ado: ${reason.message}\n`);
    process.exit(reason.exitCode);
  } else if (reason instanceof Error) {
    process.stderr.write(`ado: ${reason.message}\n`);
    process.exit(1);
  } else {
    process.stderr.write(`ado: unexpected error: ${String(reason)}\n`);
    process.exit(1);
  }
});

program.parseAsync(process.argv).catch((err: unknown) => {
  if (err instanceof AdoError) {
    process.stderr.write(`ado: ${err.message}\n`);
    process.exit(err.exitCode);
  } else if (err instanceof Error) {
    process.stderr.write(`ado: ${err.message}\n`);
    process.exit(1);
  }
});
