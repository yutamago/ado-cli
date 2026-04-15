import * as child_process from 'child_process';
import { Command } from 'commander';
import { getWebApi } from '../../api/client.js';
import { getConfig } from '../../config/index.js';
import { AdoError } from '../../errors/index.js';

async function repoCloneHandler(
  repo: string,
  directory: string | undefined,
  options: { project?: string; org?: string }
): Promise<void> {
  const config = getConfig({ orgUrl: options.org, project: options.project });
  const connection = await getWebApi(config.orgUrl);
  const gitApi = await connection.getGitApi();

  const repoInfo = await gitApi.getRepository(repo, config.project);
  if (!repoInfo) throw new AdoError(`Repository '${repo}' not found in project '${config.project}'.`);
  const remoteUrl = repoInfo.remoteUrl;
  if (!remoteUrl) throw new AdoError(`Repository '${repo}' has no remote URL.`);

  const args = ['clone', remoteUrl];
  if (directory) args.push(directory);

  await new Promise<void>((resolve, reject) => {
    const proc = child_process.spawn('git', args, { stdio: 'inherit' });
    proc.on('close', (code) =>
      code === 0 ? resolve() : reject(new AdoError(`git clone failed with exit code ${code}`)),
    );
    proc.on('error', (err) => reject(new AdoError(`Failed to run git: ${err.message}`)));
  });
}

export function registerRepoClone(repoCmd: Command): void {
  repoCmd
    .command('clone <repo> [directory]')
    .description('Clone a repository locally')
    .option('-p, --project <project>', 'Azure DevOps project (overrides config)')
    .option('--org <url>', 'Azure DevOps organization URL (overrides config)')
    .action(repoCloneHandler);
}
