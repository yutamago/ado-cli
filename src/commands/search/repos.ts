import { Command } from 'commander';
import { getWebApi } from '../../api/client.js';
import { searchRepos } from '../../api/search.js';
import { getConfig } from '../../config/index.js';
import { outputTable, outputJson } from '../../output/index.js';

async function searchReposHandler(
  query: string,
  options: { limit?: string; project?: string; org?: string; json?: string | boolean }
): Promise<void> {
  const config = getConfig({ orgUrl: options.org, project: options.project });
  const connection = await getWebApi(config.orgUrl);

  const results = await searchRepos(connection, config.project, query, {
    limit: options.limit ? parseInt(options.limit, 10) : 30,
  });

  if (options.json !== undefined) {
    outputJson(results, typeof options.json === 'string' ? options.json : undefined);
    return;
  }

  if (results.length === 0) {
    process.stdout.write('No repositories found.\n');
    return;
  }

  outputTable(
    ['NAME', 'DEFAULT BRANCH', 'URL'],
    results.map(r => [r.name, r.defaultBranch, r.url])
  );
}

export function registerSearchRepos(searchCmd: Command): void {
  searchCmd
    .command('repos <query>')
    .description('Search repositories in Azure DevOps')
    .option('--limit <number>', 'Max results', '30')
    .option('-p, --project <project>', 'Azure DevOps project (overrides config)')
    .option('--org <url>', 'Azure DevOps organization URL (overrides config)')
    .option('--json [fields]', 'Output as JSON')
    .action(searchReposHandler);
}
