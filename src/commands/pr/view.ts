import { Command } from 'commander';
import { getWebApi } from '../../api/client.js';
import { getPullRequest, resolveRepo, buildPrWebUrl } from '../../api/pullRequests.js';
import { getConfig } from '../../config/index.js';
import { outputDetail, outputJson, relativeDate, colorPrState } from '../../output/index.js';

async function prViewHandler(
  prId: string,
  options: { repo?: string; project?: string; org?: string; json?: string | boolean; comments?: boolean; web?: boolean }
): Promise<void> {
  const numId = parseInt(prId, 10);
  if (isNaN(numId)) {
    process.stderr.write(`ado: invalid PR number: ${prId}\n`);
    process.exit(1);
  }

  const config = getConfig({ orgUrl: options.org, project: options.project });

  if (options.web) {
    const connection = await getWebApi(config.orgUrl);
    const repoName = await resolveRepo(connection, config.project, options.repo);
    const url = buildPrWebUrl(config.orgUrl, config.project, repoName, numId);
    const openMod = await import('open');
    await openMod.default(url);
    return;
  }

  const connection = await getWebApi(config.orgUrl);
  const repoName = await resolveRepo(connection, config.project, options.repo);
  const { pr, threads } = await getPullRequest(connection, config.project, repoName, numId, options.comments ?? false);

  if (options.json !== undefined) {
    outputJson({ ...pr, threads }, typeof options.json === 'string' ? options.json : undefined);
    return;
  }

  outputDetail([
    ['title', pr.title + (pr.isDraft ? ' [DRAFT]' : '')],
    ['state', colorPrState(pr.status)],
    ['author', pr.author],
    ['branch', `${pr.sourceBranch} → ${pr.targetBranch}`],
    ['repo', pr.repo],
    ['labels', pr.labels.join(', ')],
    ['reviewers', pr.reviewers.map(r => `${r.name} (${r.vote})`).join(', ')],
    ['created', relativeDate(pr.createdAt)],
    ['url', pr.url],
  ]);

  if (pr.description) {
    process.stdout.write('\n' + pr.description + '\n');
  }

  if (threads.length > 0) {
    process.stdout.write('\n── Comments ─────────────────────────────────────────\n');
    for (const thread of threads) {
      const fileInfo = thread.fileContext
        ? ` ${thread.fileContext.filePath}` +
          (thread.fileContext.startLine !== undefined
            ? `:${thread.fileContext.startLine}` +
              (thread.fileContext.endLine !== undefined && thread.fileContext.endLine !== thread.fileContext.startLine
                ? `-${thread.fileContext.endLine}`
                : '')
            : '')
        : '';
      process.stdout.write(`\n── Thread #${thread.id} [${thread.status}]${fileInfo} ${'─'.repeat(Math.max(0, 40 - String(thread.id).length - fileInfo.length))}\n`);
      for (const c of thread.comments) {
        process.stdout.write(`\n${c.author}  ${relativeDate(c.createdAt)}\n${c.content}\n`);
      }
    }
  }
}

export function registerPrView(prCmd: Command): void {
  prCmd
    .command('view <pr-number>')
    .description('Display title, body, and other information about a pull request')
    .option('-r, --repo <repo>', 'Repository name')
    .option('-p, --project <project>', 'Azure DevOps project (overrides config)')
    .option('--org <url>', 'Azure DevOps organization URL (overrides config)')
    .option('--comments', 'Show review comments and threads')
    .option('--json [fields]', 'Output as JSON (optional comma-separated fields)')
    .option('-w, --web', 'Open in browser')
    .action(prViewHandler);
}
