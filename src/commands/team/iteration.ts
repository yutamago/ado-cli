import { Command } from 'commander';
import { getWebApi } from '../../api/client.js';
import { getTeamIterations } from '../../api/teamSettings.js';
import { getConfig } from '../../config/index.js';
import { outputTable, outputJson } from '../../output/index.js';

async function teamIterationListHandler(
  team: string,
  options: {
    current?: boolean;
    project?: string;
    org?: string;
    json?: string | boolean;
  },
): Promise<void> {
  const config = getConfig({ orgUrl: options.org, project: options.project });
  const connection = await getWebApi(config.orgUrl);

  const iterations = await getTeamIterations(connection, config.project, team, {
    current: options.current,
  });

  if (options.json !== undefined) {
    outputJson(
      iterations.map((i) => ({
        id: i.id,
        name: i.name,
        path: i.path,
        startDate: i.attributes?.startDate ?? null,
        finishDate: i.attributes?.finishDate ?? null,
        timeFrame: i.attributes?.timeFrame ?? null,
      })),
      typeof options.json === 'string' ? options.json : undefined,
    );
    return;
  }

  if (iterations.length === 0) {
    process.stdout.write('No iterations found.\n');
    return;
  }

  outputTable(
    ['NAME', 'PATH', 'START', 'FINISH', 'TIMEFRAME'],
    iterations.map((i) => [
      i.name ?? '',
      i.path ?? '',
      i.attributes?.startDate ? new Date(i.attributes.startDate).toISOString().slice(0, 10) : '',
      i.attributes?.finishDate ? new Date(i.attributes.finishDate).toISOString().slice(0, 10) : '',
      String(i.attributes?.timeFrame ?? ''),
    ]),
  );
}

export function registerTeamIteration(teamCmd: Command): void {
  const iteration = teamCmd.command('iteration').description('Manage team iterations (sprints)');

  iteration
    .command('list <team>')
    .description('List iterations for a team')
    .option('--current', 'Show only the current iteration')
    .option('-p, --project <project>', 'Azure DevOps project (overrides config)')
    .option('--org <url>', 'Azure DevOps organization URL (overrides config)')
    .option('--json [fields]', 'Output as JSON')
    .action(teamIterationListHandler);
}
