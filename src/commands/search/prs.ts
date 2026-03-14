import { Command } from 'commander';
import { getWebApi } from '../../api/client.js';
import { searchPrs } from '../../api/search.js';
import { getConfig } from '../../config/index.js';
import { outputTable, outputJson, relativeDate, colorPrState, truncate } from '../../output/index.js';

async function searchPrsHandler(
  query: string,
  options: { state?: string; limit?: string; project?: string; org?: string; json?: string | boolean }
): Promise<void> {
  const config = getConfig({ orgUrl: options.org, project: options.project });
  const connection = await getWebApi(config.orgUrl);

  const results = await searchPrs(connection, config.project, query, {
    state: options.state,
    limit: options.limit ? parseInt(options.limit, 10) : 25,
  });

  if (options.json !== undefined) {
    outputJson(results, typeof options.json === 'string' ? options.json : undefined);
    return;
  }

  if (results.length === 0) {
    process.stdout.write('No pull requests found.\n');
    return;
  }

  outputTable(
    ['#PR', 'TITLE', 'AUTHOR', 'STATUS', 'REPO', 'UPDATED'],
    results.map(r => [
      String(r.id),
      truncate(r.title, 50),
      truncate(r.author, 20),
      colorPrState(r.status),
      r.repo,
      relativeDate(r.updatedAt),
    ])
  );
}

export function registerSearchPrs(searchCmd: Command): void {
  searchCmd
    .command('prs <query>')
    .description('Search pull requests in Azure DevOps')
    .option('-s, --state <state>', 'Filter by state: open|closed|merged|all', 'all')
    .option('--limit <number>', 'Max results', '25')
    .option('-p, --project <project>', 'Azure DevOps project (overrides config)')
    .option('--org <url>', 'Azure DevOps organization URL (overrides config)')
    .option('--json [fields]', 'Output as JSON')
    .action(searchPrsHandler);
}
