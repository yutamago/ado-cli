import { Command } from 'commander';
import { getWebApi } from '../../api/client.js';
import { listPullRequests } from '../../api/pullRequests.js';
import { getConfig } from '../../config/index.js';
import { outputTable, outputJson, relativeDate, colorPrState, truncate } from '../../output/index.js';

async function prListHandler(options: {
  state?: string;
  author?: string;
  repo?: string;
  limit?: string;
  project?: string;
  org?: string;
  json?: string | boolean;
}): Promise<void> {
  const config = getConfig({ orgUrl: options.org, project: options.project });
  const connection = await getWebApi(config.orgUrl);

  const prs = await listPullRequests(connection, config.project, {
    state: options.state,
    repo: options.repo,
    author: options.author,
    limit: options.limit ? parseInt(options.limit, 10) : 30,
  });

  if (options.json !== undefined) {
    outputJson(prs, typeof options.json === 'string' ? options.json : undefined);
    return;
  }

  if (prs.length === 0) {
    process.stdout.write('No pull requests found.\n');
    return;
  }

  outputTable(
    ['#PR', 'TITLE', 'AUTHOR', 'STATUS', 'BRANCH', 'REPO', 'UPDATED'],
    prs.map(pr => [
      String(pr.id),
      truncate(pr.title, 50) + (pr.isDraft ? ' [DRAFT]' : ''),
      truncate(pr.author, 20),
      colorPrState(pr.status),
      truncate(`${pr.sourceBranch} → ${pr.targetBranch}`, 40),
      pr.repo,
      relativeDate(pr.updatedAt),
    ])
  );
}

export function registerPrList(prCmd: Command): void {
  prCmd
    .command('list')
    .description('List pull requests in a repository')
    .option('-s, --state <state>', 'Filter by state: open|closed|merged|all', 'open')
    .option('-a, --author <author>', 'Filter by author')
    .option('-r, --repo <repo>', 'Repository name')
    .option('--limit <number>', 'Max items to return', '30')
    .option('-p, --project <project>', 'Azure DevOps project (overrides config)')
    .option('--org <url>', 'Azure DevOps organization URL (overrides config)')
    .option('--json [fields]', 'Output as JSON (optional comma-separated fields)')
    .action(prListHandler);
}
