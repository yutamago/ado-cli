import { Command } from 'commander';
import { getWebApi } from '../../api/client.js';
import { listWorkItems } from '../../api/workItems.js';
import { getConfig } from '../../config/index.js';
import { outputTable, outputJson, relativeDate, colorState, truncate } from '../../output/index.js';
import { getTeamIterations, getTeams } from '../../api/teamSettings.js';
import { WebApi } from 'azure-devops-node-api';


async function getIterationPathByOptions(connection: WebApi, project: string, iteration: string | undefined): Promise<string | undefined> {
  if (!iteration) {
    return undefined;
  }

  iteration = iteration.toLowerCase();

  if (iteration === 'all') {
    return undefined;
  }

  if (iteration !== 'current' && iteration !== 'next') {
    return iteration;
  }


  const myTeams = await getTeams(connection, project, { mine: true });

  if (myTeams.length === 0) {
    process.stdout.write('No teams found for the current user.\n');
    return undefined;
  }

  const team = myTeams[0].name!;
  const iterations = await getTeamIterations(connection, project, team, { current: true });

  if (iterations.length === 0) {
    process.stdout.write(`No current iteration found for team ${team}.\n`);
    return undefined;
  }

  const currentIteration = iterations[0];
  if (iteration === 'current') {
    return currentIteration.path;
  }

  if (iteration === 'next') {
    const allIterations = await getTeamIterations(connection, project, team, {});
    const currentIndex = allIterations.findIndex(i => i.id === currentIteration.id);

    if (currentIndex === -1 || currentIndex === allIterations.length - 1) {
      process.stdout.write(`No next iteration found for team ${team}.\n`);
      return undefined;
    }

    return allIterations[currentIndex + 1].path;
  }

  return undefined;
}

async function issueListHandler(options: {
  state?: string;
  assignee?: string;
  iteration?: string;
  label?: string;
  limit?: string;
  project?: string;
  org?: string;
  json?: string | boolean;
  type?: string;
  web?: boolean;
}): Promise<void> {
  const config = getConfig({ orgUrl: options.org, project: options.project });

  if (options.web) {
    const url = `${config.orgUrl}/${encodeURIComponent(config.project)}/_workitems`;
    const openMod = await import('open');
    await openMod.default(url);
    return;
  }

  const connection = await getWebApi(config.orgUrl);

  let iterationPath = await getIterationPathByOptions(connection, config.project, options.iteration);

  const items = await listWorkItems(connection, config.project, {
    state: options.state,
    assignee: options.assignee,
    tag: options.label,
    limit: options.limit ? parseInt(options.limit, 10) : 30,
    type: options.type,
    iterationPath,
  });

  if (options.json !== undefined) {
    const mapped = items.map(i => ({
      id: i.id,
      type: i.type,
      title: i.title,
      state: i.state,
      assignee: i.assignee,
      tags: i.tags,
      updatedAt: i.updatedAt,
      url: i.url,
    }));
    outputJson(mapped, typeof options.json === 'string' ? options.json : undefined);
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

export function registerIssueList(issueCmd: Command): void {
  issueCmd
    .command('list')
    .description('List work items in a project')
    .option('-s, --state <state>', 'Filter by states (comma-separated, e.g. open,closed)', '!removed & !deleted & !closed')
    .option('-a, --assignee <assignee>', 'Filter by assignee (use @me for yourself)')
    .option('-l, --label <label>', 'Filter by tag/label')
    .option('-i, --iteration <path>', 'Filter by iteration path (or current, next, all)', 'current')
    .option('-t, --type <type>', 'Filter by work item type (e.g. Bug, Task, User Story)')
    .option('--limit <number>', 'Max items to return', '30')
    .option('-p, --project <project>', 'Azure DevOps project (overrides config)')
    .option('--org <url>', 'Azure DevOps organization URL (overrides config)')
    .option('--json [fields]', 'Output as JSON (optional comma-separated fields)')
    .option('-w, --web', 'Open in browser')
    .action(issueListHandler);
}
