import { Command } from 'commander';
import { registerPrList } from './list.js';
import { registerPrView } from './view.js';
import { registerPrComment } from './comment.js';
import { registerPrDiff } from './diff.js';
import { registerPrCreate } from './create.js';
import { registerPrReview } from './review.js';
import { registerPrThread } from './thread.js';

export function registerPrCommands(program: Command): void {
  const pr = program.command('pr').description('Manage Azure DevOps pull requests');
  registerPrList(pr);
  registerPrView(pr);
  registerPrComment(pr);
  registerPrDiff(pr);
  registerPrCreate(pr);
  registerPrReview(pr);
  registerPrThread(pr);
}
