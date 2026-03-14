import { Command } from 'commander';
import { getWebApi } from '../../api/client.js';
import { getWorkItem } from '../../api/workItems.js';
import { getConfig } from '../../config/index.js';
import { outputDetail, outputJson, relativeDate, colorState } from '../../output/index.js';

// Strip basic HTML tags from description
function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<li>/gi, '  • ')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

async function issueViewHandler(
  id: string,
  options: { project?: string; org?: string; json?: string | boolean; comments?: boolean }
): Promise<void> {
  const numId = parseInt(id, 10);
  if (isNaN(numId)) {
    process.stderr.write(`azd: invalid work item ID: ${id}\n`);
    process.exit(1);
  }

  const config = getConfig({ orgUrl: options.org, project: options.project });
  const connection = await getWebApi(config.orgUrl);
  const { item, comments } = await getWorkItem(connection, config.project, numId, options.comments ?? false);

  if (options.json !== undefined) {
    outputJson(
      { ...item, comments },
      typeof options.json === 'string' ? options.json : undefined
    );
    return;
  }

  outputDetail([
    ['title', item.title],
    ['type', item.type],
    ['state', colorState(item.state)],
    ['assignee', item.assignee],
    ['priority', item.priority],
    ['tags', item.tags],
    ['area', item.areaPath],
    ['iteration', item.iterationPath],
    ['created', relativeDate(item.createdAt)],
    ['updated', relativeDate(item.updatedAt)],
    ['comments', item.commentCount > 0 ? String(item.commentCount) : null],
    ['url', item.url],
  ]);

  if (item.description) {
    process.stdout.write('\n' + stripHtml(item.description) + '\n');
  }

  if (comments.length > 0) {
    process.stdout.write('\n── Comments ─────────────────────────────────────────\n');
    for (const c of comments) {
      process.stdout.write(`\n${c.author}  ${relativeDate(c.createdAt)}\n${stripHtml(c.text)}\n`);
    }
  }
}

export function registerIssueView(issueCmd: Command): void {
  issueCmd
    .command('view <id>')
    .description('Show details for a work item')
    .option('-p, --project <project>', 'Azure DevOps project (overrides config)')
    .option('--org <url>', 'Azure DevOps organization URL (overrides config)')
    .option('--comments', 'Show comments')
    .option('--json [fields]', 'Output as JSON (optional comma-separated fields)')
    .action(issueViewHandler);
}
