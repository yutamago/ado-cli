import { Command } from 'commander';
import { getWebApi } from '../../api/client.js';
import { listPullRequests } from '../../api/pullRequests.js';
import { getConfig } from '../../config/index.js';
import { outputTable, outputJson, relativeDate, colorPrState, truncate } from '../../output/index.js';
import { styleText } from 'node:util';

async function prListHandler(options: {
  state?: string;
  author?: string;
  repo?: string;
  limit?: string;
  project?: string;
  org?: string;
  json?: string | boolean;
  web?: boolean;
  draft?: string | boolean;
}): Promise<void> {
  const config = getConfig({ orgUrl: options.org, project: options.project });

  if (options.web) {
    const { getWebApi: _getWebApi } = await import('../../api/client.js');
    const { resolveRepo } = await import('../../api/pullRequests.js');
    const connection = await _getWebApi(config.orgUrl);
    const repoName = await resolveRepo(connection, config.project, options.repo).catch(() => undefined);
    const url = repoName
      ? `${config.orgUrl}/${encodeURIComponent(config.project)}/_git/${encodeURIComponent(repoName)}/pullrequests`
      : `${config.orgUrl}/${encodeURIComponent(config.project)}/_pulls`;
    const openMod = await import('open');
    await openMod.default(url);
    return;
  }

  const connection = await getWebApi(config.orgUrl);

  const draftMode = options.draft === 'only' ? 'only' : options.draft ? 'include' : 'exclude';
  const limit = options.limit ? parseInt(options.limit, 10) : 30;

  // When excluding drafts, fetch all (including drafts) so we can count hidden ones.
  const allPrs = await listPullRequests(connection, config.project, {
    state: options.state,
    repo: options.repo,
    author: options.author,
    limit,
    draft: draftMode === 'exclude' ? 'include' : draftMode,
  });

  const prs = draftMode === 'exclude' ? allPrs.filter(pr => !pr.isDraft) : allPrs;
  const hiddenDraftCount = draftMode === 'exclude' ? allPrs.length - prs.length : 0;

  if (options.json !== undefined) {
    outputJson(prs, typeof options.json === 'string' ? options.json : undefined);
    return;
  }

  const hiddenDraftMsg = hiddenDraftCount > 0 ? styleText('dim', `Result contains ${hiddenDraftCount} hidden draft PR${hiddenDraftCount === 1 ? '' : 's'}. Use \`--draft\` to include or \`--draft only\` to filter.\n`) : '';

  if (prs.length === 0) {
    process.stdout.write('No pull requests found.\n');
    if (hiddenDraftCount > 0) {
      process.stderr.write(hiddenDraftMsg);
    }
    return;
  }

  outputTable(
    ['#PR', 'TITLE', 'AUTHOR', 'STATUS', 'BRANCH', 'REPO', 'UPDATED'],
    prs.map(pr => [
      String(pr.id),
      truncate(pr.title, 50) + (pr.isDraft ? ' [DRAFT]' : ''),
      truncate(pr.author, 20),
      colorPrState(pr.status),
      truncate(`${pr.sourceBranch} → ${pr.targetBranch}`, 40),
      pr.repo,
      relativeDate(pr.updatedAt),
    ])
  );

  if (hiddenDraftCount > 0) {
    process.stderr.write(hiddenDraftMsg);
  }
}

export function registerPrList(prCmd: Command): void {
  prCmd
    .command('list')
    .description('List pull requests in a repository')
    .option('-s, --state <state>', 'Filter by state: open|closed|merged|all', 'open')
    .option('-a, --author <author>', 'Filter by author')
    .option('-r, --repo <repo>', 'Repository name')
    .option('--limit <number>', 'Max items to return', '30')
    .option('-p, --project <project>', 'Azure DevOps project (overrides config)')
    .option('--org <url>', 'Azure DevOps organization URL (overrides config)')
    .option('--json [fields]', 'Output as JSON (optional comma-separated fields)')
    .option('-w, --web', 'Open in browser')
    .option('--draft [only]', 'Include drafts (--draft) or show only drafts (--draft only)')
    .action(prListHandler);
}
