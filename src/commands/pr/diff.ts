import { Command } from 'commander';
import { styleText } from 'node:util';
import { minimatch } from 'minimatch';
import { getWebApi } from '../../api/client.js';
import { getPrChangedFiles, getPrDiff, buildPrWebUrl, resolveRepo } from '../../api/pullRequests.js';
import { getConfig } from '../../config/index.js';

// ─── Color theme matching GitHub CLI ─────────────────────────────────────────

function colorize(diff: string): string {
  return diff.split('\n').map(line => {
    if (line.startsWith('diff --git')) return styleText('bold', line);
    if (line.startsWith('--- ') || line.startsWith('+++ ')) return styleText('bold', line);
    if (line.startsWith('@@')) return styleText('cyan', line);
    if (line.startsWith('+')) return styleText('green', line);
    if (line.startsWith('-')) return styleText('red', line);
    return line;
  }).join('\n');
}

function shouldUseColor(colorFlag: string): boolean {
  switch (colorFlag) {
    case 'always': return true;
    case 'never':  return false;
    default:       return process.stdout.isTTY ?? false; // auto
  }
}

// ─── Command handler ──────────────────────────────────────────────────────────

async function prDiffHandler(
  prId: string,
  options: {
    repo?: string;
    project?: string;
    org?: string;
    nameOnly?: boolean;
    patch?: boolean;
    exclude: string[];
    color: string;
    web?: boolean;
  }
): Promise<void> {
  const numId = parseInt(prId, 10);
  if (isNaN(numId)) {
    process.stderr.write(`azd: invalid PR number: ${prId}\n`);
    process.exit(1);
  }

  const config = getConfig({ orgUrl: options.org, project: options.project });
  const connection = await getWebApi(config.orgUrl);
  const repoName = await resolveRepo(connection, config.project, options.repo);

  // --web: open PR in browser
  if (options.web) {
    const url = buildPrWebUrl(config.orgUrl, config.project, repoName, numId);
    const openMod = await import('open');
    await openMod.default(url);
    process.stdout.write(`Opening ${url} in your browser.\n`);
    return;
  }

  // --name-only: one file path per line
  if (options.nameOnly) {
    const changes = await getPrChangedFiles(connection, config.project, repoName, numId);
    if (changes.length === 0) {
      process.stdout.write('No changes found.\n');
      return;
    }
    // Apply exclude filter
    const filtered = options.exclude.length
      ? changes.filter(c => {
          const bare = c.path.replace(/^\//, '');
          return !options.exclude.some(p => minimatch(c.path, p) || minimatch(bare, p));
        })
      : changes;
    for (const c of filtered) {
      process.stdout.write(c.path + '\n');
    }
    return;
  }

  // Default (--patch is implicit): full unified diff
  const diff = await getPrDiff(connection, config.project, repoName, numId, options.exclude);
  if (!diff) {
    process.stdout.write('No changes found.\n');
    return;
  }

  const output = shouldUseColor(options.color) ? colorize(diff) : diff;
  process.stdout.write(output);
}

// ─── Registration ─────────────────────────────────────────────────────────────

export function registerPrDiff(prCmd: Command): void {
  prCmd
    .command('diff <pr-number>')
    .description('View changes in a pull request')
    .option('-r, --repo <repo>', 'Repository name')
    .option('-p, --project <project>', 'Azure DevOps project (overrides config)')
    .option('--org <url>', 'Azure DevOps organization URL (overrides config)')
    .option('--name-only', 'Display only names of changed files')
    .option('--patch', 'Display diff in patch format (default)')
    .option(
      '-e, --exclude <pattern>',
      'Exclude files matching a glob pattern (repeatable)',
      (val: string, prev: string[]) => prev.concat([val]),
      [] as string[],
    )
    .option('--color <when>', 'Use color in diff output: always|never|auto (default: auto)', 'auto')
    .option('-w, --web', 'Open the pull request diff in the browser')
    .action(prDiffHandler);
}
