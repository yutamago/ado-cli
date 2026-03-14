import { Command } from 'commander';
import { getWebApi } from '../../api/client.js';
import { getPrChangedFiles, resolveRepo } from '../../api/pullRequests.js';
import { getConfig } from '../../config/index.js';

async function prDiffHandler(
  prId: string,
  options: { repo?: string; project?: string; org?: string; nameOnly?: boolean }
): Promise<void> {
  const numId = parseInt(prId, 10);
  if (isNaN(numId)) {
    process.stderr.write(`azd: invalid PR number: ${prId}\n`);
    process.exit(1);
  }

  const config = getConfig({ orgUrl: options.org, project: options.project });
  const connection = await getWebApi(config.orgUrl);
  const repoName = await resolveRepo(connection, config.project, options.repo);

  const changes = await getPrChangedFiles(connection, config.project, repoName, numId);

  if (changes.length === 0) {
    process.stdout.write('No changes found.\n');
    return;
  }

  if (options.nameOnly) {
    // Agent-optimized: one file per line, no diff content
    for (const c of changes) {
      process.stdout.write(c.path + '\n');
    }
    return;
  }

  // Unified diff-style output (file list with change types)
  for (const c of changes) {
    const changeLabel = mapChangeType(c.changeType);
    process.stdout.write(`${changeLabel}\t${c.path}\n`);
  }
}

function mapChangeType(changeType: string): string {
  // VersionControlChangeType enum values
  const n = parseInt(changeType, 10);
  switch (n) {
    case 1: return 'add';
    case 2: return 'edit';
    case 4: return 'encode';
    case 8: return 'rename';
    case 16: return 'delete';
    case 32: return 'undelete';
    case 64: return 'branch';
    case 128: return 'merge';
    case 256: return 'lock';
    case 512: return 'rollback';
    case 1024: return 'sourceRename';
    case 2048: return 'targetRename';
    case 4096: return 'property';
    default: return changeType || 'change';
  }
}

export function registerPrDiff(prCmd: Command): void {
  prCmd
    .command('diff <pr-number>')
    .description('View changes in a pull request')
    .option('-r, --repo <repo>', 'Repository name')
    .option('-p, --project <project>', 'Azure DevOps project (overrides config)')
    .option('--org <url>', 'Azure DevOps organization URL (overrides config)')
    .option('--name-only', 'Show only changed file paths (one per line, agent-optimized)')
    .action(prDiffHandler);
}
