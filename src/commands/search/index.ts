import { Command } from 'commander';
import { registerSearchIssues } from './issues.js';
import { registerSearchCode } from './code.js';
import { registerSearchCommits } from './commits.js';
import { registerSearchPrs } from './prs.js';
import { registerSearchRepos } from './repos.js';

export function registerSearchCommands(program: Command): void {
  const search = program.command('search').description('Search across Azure DevOps');
  registerSearchIssues(search);
  registerSearchCode(search);
  registerSearchCommits(search);
  registerSearchPrs(search);
  registerSearchRepos(search);
}
