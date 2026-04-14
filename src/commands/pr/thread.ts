import { Command } from 'commander';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as child_process from 'child_process';
import { getWebApi } from '../../api/client.js';
import { replyToThread, setThreadStatus, resolveRepo } from '../../api/pullRequests.js';
import { getConfig } from '../../config/index.js';
import { AdoError } from '../../errors/index.js';

function openEditor(initial = ''): string {
  const editor = process.env['VISUAL'] ?? process.env['EDITOR'] ?? (process.platform === 'win32' ? 'notepad' : 'vi');
  const tmpFile = path.join(os.tmpdir(), `ado-pr-thread-${Date.now()}.md`);
  fs.writeFileSync(tmpFile, initial, 'utf8');

  try {
    child_process.execFileSync(editor, [tmpFile], { stdio: 'inherit' });
  } catch {
    // Editor may exit non-zero on cancel
  }

  const content = fs.readFileSync(tmpFile, 'utf8').trim();
  fs.unlinkSync(tmpFile);
  return content;
}

async function prThreadReplyHandler(
  prId: string,
  threadId: string,
  options: { body?: string; editor?: boolean; repo?: string; project?: string; org?: string }
): Promise<void> {
  const numPrId = parseInt(prId, 10);
  if (isNaN(numPrId)) {
    process.stderr.write(`ado: invalid PR number: ${prId}\n`);
    process.exit(1);
  }

  const numThreadId = parseInt(threadId, 10);
  if (isNaN(numThreadId)) {
    process.stderr.write(`ado: invalid thread ID: ${threadId}\n`);
    process.exit(1);
  }

  let body = options.body;

  if (!body || options.editor) {
    body = openEditor(body ?? '');
  }

  if (!body) {
    throw new AdoError('Reply body cannot be empty.');
  }

  const config = getConfig({ orgUrl: options.org, project: options.project });
  const connection = await getWebApi(config.orgUrl);
  const repoName = await resolveRepo(connection, config.project, options.repo);

  await replyToThread(connection, config.project, repoName, numPrId, numThreadId, body);
  process.stdout.write(`Replied to thread #${numThreadId} on PR #${numPrId}\n`);
}

async function prThreadStatusHandler(
  prId: string,
  threadId: string,
  options: {
    active?: boolean;
    resolve?: boolean;
    pending?: boolean;
    wontFix?: boolean;
    close?: boolean;
    repo?: string;
    project?: string;
    org?: string;
  }
): Promise<void> {
  const numPrId = parseInt(prId, 10);
  if (isNaN(numPrId)) {
    process.stderr.write(`ado: invalid PR number: ${prId}\n`);
    process.exit(1);
  }

  const numThreadId = parseInt(threadId, 10);
  if (isNaN(numThreadId)) {
    process.stderr.write(`ado: invalid thread ID: ${threadId}\n`);
    process.exit(1);
  }

  // Exactly one status flag required
  const flags = [options.active, options.resolve, options.pending, options.wontFix, options.close].filter(Boolean);
  if (flags.length === 0) {
    throw new AdoError('Specify one of: --active, --resolve, --pending, --wont-fix, --close');
  }
  if (flags.length > 1) {
    throw new AdoError('Specify only one of: --active, --resolve, --pending, --wont-fix, --close');
  }

  // CommentThreadStatus enum values
  let statusValue: number;
  let statusLabel: string;
  if (options.active) { statusValue = 1; statusLabel = 'Active'; }
  else if (options.resolve) { statusValue = 2; statusLabel = 'Resolved'; }
  else if (options.wontFix) { statusValue = 3; statusLabel = 'WontFix'; }
  else if (options.close) { statusValue = 4; statusLabel = 'Closed'; }
  else { statusValue = 6; statusLabel = 'Pending'; } // options.pending

  const config = getConfig({ orgUrl: options.org, project: options.project });
  const connection = await getWebApi(config.orgUrl);
  const repoName = await resolveRepo(connection, config.project, options.repo);

  await setThreadStatus(connection, config.project, repoName, numPrId, numThreadId, statusValue);
  process.stdout.write(`Set thread #${numThreadId} on PR #${numPrId} to ${statusLabel}\n`);
}

export function registerPrThread(prCmd: Command): void {
  const thread = prCmd
    .command('thread')
    .description('Manage pull request comment threads');

  thread
    .command('reply <pr-number> <thread-id>')
    .description('Reply to an existing comment thread')
    .option('-b, --body <text>', 'Reply body')
    .option('--editor', 'Open $EDITOR to write the reply')
    .option('-r, --repo <repo>', 'Repository name')
    .option('-p, --project <project>', 'Azure DevOps project (overrides config)')
    .option('--org <url>', 'Azure DevOps organization URL (overrides config)')
    .action(prThreadReplyHandler);

  thread
    .command('status <pr-number> <thread-id>')
    .description('Set the status of a comment thread')
    .option('--active', 'Mark thread as active')
    .option('--resolve', 'Mark thread as resolved')
    .option('--pending', 'Mark thread as pending')
    .option('--wont-fix', 'Mark thread as won\'t fix')
    .option('--close', 'Mark thread as closed')
    .option('-r, --repo <repo>', 'Repository name')
    .option('-p, --project <project>', 'Azure DevOps project (overrides config)')
    .option('--org <url>', 'Azure DevOps organization URL (overrides config)')
    .action(prThreadStatusHandler);
}
