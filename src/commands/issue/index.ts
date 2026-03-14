import { Command } from 'commander';
import { registerIssueList } from './list.js';
import { registerIssueView } from './view.js';

export function registerIssueCommands(program: Command): void {
  const issue = program.command('issue').description('Manage Azure DevOps work items');
  registerIssueList(issue);
  registerIssueView(issue);
}
