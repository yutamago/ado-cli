import { Command } from 'commander';
import { getWebApi } from '../../api/client.js';
import { listWorkItems } from '../../api/workItems.js';
import { getConfig } from '../../config/index.js';
import { outputTable, outputJson, relativeDate, colorState, truncate } from '../../output/index.js';

async function issueListHandler(options: {
  state?: string;
  assignee?: string;
  label?: string;
  limit?: string;
  project?: string;
  org?: string;
  json?: string | boolean;
  type?: string;
}): Promise<void> {
  const config = getConfig({ orgUrl: options.org, project: options.project });
  const connection = await getWebApi(config.orgUrl);

  const items = await listWorkItems(connection, config.project, {
    state: options.state,
    assignee: options.assignee,
    tag: options.label,
    limit: options.limit ? parseInt(options.limit, 10) : 30,
    type: options.type,
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
    .option('-s, --state <state>', 'Filter by state: open|closed|all', 'open')
    .option('-a, --assignee <assignee>', 'Filter by assignee (use @me for yourself)')
    .option('-l, --label <label>', 'Filter by tag/label')
    .option('-t, --type <type>', 'Filter by work item type (e.g. Bug, Task, User Story)')
    .option('--limit <number>', 'Max items to return', '30')
    .option('-p, --project <project>', 'Azure DevOps project (overrides config)')
    .option('--org <url>', 'Azure DevOps organization URL (overrides config)')
    .option('--json [fields]', 'Output as JSON (optional comma-separated fields)')
    .action(issueListHandler);
}
