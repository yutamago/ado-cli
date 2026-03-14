import { Command } from 'commander';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as child_process from 'child_process';
import { getWebApi } from '../../api/client.js';
import { addPrComment, resolveRepo } from '../../api/pullRequests.js';
import { getConfig } from '../../config/index.js';
import { AzdError } from '../../errors/index.js';

function openEditor(initial = ''): string {
  const editor = process.env['VISUAL'] ?? process.env['EDITOR'] ?? (process.platform === 'win32' ? 'notepad' : 'vi');
  const tmpFile = path.join(os.tmpdir(), `azd-pr-comment-${Date.now()}.md`);
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

async function prCommentHandler(
  prId: string,
  options: { body?: string; repo?: string; project?: string; org?: string; editor?: boolean }
): Promise<void> {
  const numId = parseInt(prId, 10);
  if (isNaN(numId)) {
    process.stderr.write(`azd: invalid PR number: ${prId}\n`);
    process.exit(1);
  }

  let body = options.body;

  if (!body || options.editor) {
    body = openEditor(body ?? '');
  }

  if (!body) {
    throw new AzdError('Comment body cannot be empty.');
  }

  const config = getConfig({ orgUrl: options.org, project: options.project });
  const connection = await getWebApi(config.orgUrl);
  const repoName = await resolveRepo(connection, config.project, options.repo);

  await addPrComment(connection, config.project, repoName, numId, body);
  process.stdout.write(`Added comment to PR #${numId}\n`);
}

export function registerPrComment(prCmd: Command): void {
  prCmd
    .command('comment <pr-number>')
    .description('Add a comment to a pull request')
    .option('-b, --body <text>', 'Comment body')
    .option('--editor', 'Open editor to write the comment')
    .option('-r, --repo <repo>', 'Repository name')
    .option('-p, --project <project>', 'Azure DevOps project (overrides config)')
    .option('--org <url>', 'Azure DevOps organization URL (overrides config)')
    .action(prCommentHandler);
}
