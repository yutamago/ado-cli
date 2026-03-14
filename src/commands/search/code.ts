import { Command } from 'commander';
import { getWebApi } from '../../api/client.js';
import { searchCode } from '../../api/search.js';
import { getConfig } from '../../config/index.js';
import { outputTable, outputJson, truncate } from '../../output/index.js';

async function searchCodeHandler(
  query: string,
  options: { repo?: string; limit?: string; project?: string; org?: string; json?: string | boolean }
): Promise<void> {
  const config = getConfig({ orgUrl: options.org, project: options.project });
  const connection = await getWebApi(config.orgUrl);

  const results = await searchCode(connection, config.project, query, {
    repo: options.repo,
    limit: options.limit ? parseInt(options.limit, 10) : 25,
  });

  if (options.json !== undefined) {
    outputJson(results, typeof options.json === 'string' ? options.json : undefined);
    return;
  }

  if (results.length === 0) {
    process.stdout.write('No results found.\n');
    return;
  }

  outputTable(
    ['REPO', 'FILE', 'BRANCH', 'MATCHES'],
    results.map(r => [
      r.repo,
      truncate(r.path, 60),
      r.branch,
      String(r.matches),
    ])
  );
}

export function registerSearchCode(searchCmd: Command): void {
  searchCmd
    .command('code <query>')
    .description('Search code in Azure DevOps repositories')
    .option('-r, --repo <repo>', 'Filter by repository name')
    .option('--limit <number>', 'Max results', '25')
    .option('-p, --project <project>', 'Azure DevOps project (overrides config)')
    .option('--org <url>', 'Azure DevOps organization URL (overrides config)')
    .option('--json [fields]', 'Output as JSON')
    .action(searchCodeHandler);
}
