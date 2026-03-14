import { Command } from 'commander';
import { getWebApi } from '../../api/client.js';
import { searchCommits } from '../../api/search.js';
import { getConfig } from '../../config/index.js';
import { outputTable, outputJson, relativeDate, truncate } from '../../output/index.js';

async function searchCommitsHandler(
  query: string,
  options: { repo?: string; limit?: string; project?: string; org?: string; json?: string | boolean }
): Promise<void> {
  const config = getConfig({ orgUrl: options.org, project: options.project });
  const connection = await getWebApi(config.orgUrl);

  const results = await searchCommits(connection, config.project, query, {
    repo: options.repo,
    limit: options.limit ? parseInt(options.limit, 10) : 25,
  });

  if (options.json !== undefined) {
    outputJson(results, typeof options.json === 'string' ? options.json : undefined);
    return;
  }

  if (results.length === 0) {
    process.stdout.write('No commits found.\n');
    return;
  }

  outputTable(
    ['HASH', 'AUTHOR', 'DATE', 'MESSAGE', 'REPO'],
    results.map(r => [
      r.hash,
      truncate(r.author, 20),
      relativeDate(r.date),
      truncate(r.message, 60),
      r.repo,
    ])
  );
}

export function registerSearchCommits(searchCmd: Command): void {
  searchCmd
    .command('commits <query>')
    .description('Search commits in Azure DevOps repositories')
    .option('-r, --repo <repo>', 'Filter by repository name')
    .option('--limit <number>', 'Max results', '25')
    .option('-p, --project <project>', 'Azure DevOps project (overrides config)')
    .option('--org <url>', 'Azure DevOps organization URL (overrides config)')
    .option('--json [fields]', 'Output as JSON')
    .action(searchCommitsHandler);
}
