import { Command } from 'commander';
import { getWebApi } from '../../api/client.js';
import { getTeams } from '../../api/teamSettings.js';
import { getConfig } from '../../config/index.js';
import { outputTable, outputJson } from '../../output/index.js';

async function teamListHandler(options: {
  mine?: boolean;
  limit?: string;
  project?: string;
  org?: string;
  json?: string | boolean;
}): Promise<void> {
  const config = getConfig({ orgUrl: options.org, project: options.project });
  const connection = await getWebApi(config.orgUrl);
  const limit = parseInt(options.limit ?? '30', 10);

  const teams = await getTeams(connection, config.project, { mine: options.mine, top: limit });

  if (options.json !== undefined) {
    outputJson(
      teams.map((t) => ({ id: t.id, name: t.name, description: t.description })),
      typeof options.json === 'string' ? options.json : undefined,
    );
    return;
  }

  if (teams.length === 0) {
    process.stdout.write('No teams found.\n');
    return;
  }

  outputTable(
    ['NAME', 'DESCRIPTION'],
    teams.map((t) => [t.name ?? '', t.description ?? '']),
  );
}

export function registerTeamList(teamCmd: Command): void {
  teamCmd
    .command('list')
    .description('List teams in a project')
    .option('--mine', 'Only show teams you are a member of')
    .option('--limit <number>', 'Max results', '30')
    .option('-p, --project <project>', 'Azure DevOps project (overrides config)')
    .option('--org <url>', 'Azure DevOps organization URL (overrides config)')
    .option('--json [fields]', 'Output as JSON')
    .action(teamListHandler);
}
