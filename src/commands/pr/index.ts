import { Command } from 'commander';
import { registerPrList } from './list.js';
import { registerPrView } from './view.js';
import { registerPrComment } from './comment.js';
import { registerPrDiff } from './diff.js';

export function registerPrCommands(program: Command): void {
  const pr = program.command('pr').description('Manage Azure DevOps pull requests');
  registerPrList(pr);
  registerPrView(pr);
  registerPrComment(pr);
  registerPrDiff(pr);
}
