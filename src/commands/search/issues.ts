import { Command } from 'commander';
import { getWebApi } from '../../api/client.js';
import { searchWorkItems } from '../../api/search.js';
import { getConfig } from '../../config/index.js';
import { outputTable, outputJson, relativeDate, colorState, truncate } from '../../output/index.js';

async function searchIssuesHandler(
  query: string,
  options: { state?: string; limit?: string; project?: string; org?: string; json?: string | boolean }
): Promise<void> {
  const config = getConfig({ orgUrl: options.org, project: options.project });
  const connection = await getWebApi(config.orgUrl);

  const items = await searchWorkItems(connection, config.project, query, {
    state: options.state,
    limit: options.limit ? parseInt(options.limit, 10) : 25,
  });

  if (options.json !== undefined) {
    outputJson(items, typeof options.json === 'string' ? options.json : undefined);
    return;
  }

  if (items.length === 0) {
    process.stdout.write('No issues found.\n');
    return;
  }

  outputTable(
    ['ID', 'TYPE', 'TITLE', 'STATE', 'ASSIGNEE', 'UPDATED'],
    items.map(i => [
      String(i.id),
      i.type,
      truncate(i.title, 60),
      colorState(i.state),
      truncate(i.assignee, 20),
      relativeDate(i.updatedAt),
    ])
  );
}

export function registerSearchIssues(searchCmd: Command): void {
  searchCmd
    .command('issues <query>')
    .description('Search work items (issues) in Azure DevOps')
    .option('-s, --state <state>', 'Filter by state: open|closed|all', 'all')
    .option('--limit <number>', 'Max results', '25')
    .option('-p, --project <project>', 'Azure DevOps project (overrides config)')
    .option('--org <url>', 'Azure DevOps organization URL (overrides config)')
    .option('--json [fields]', 'Output as JSON')
    .action(searchIssuesHandler);
}
