import * as child_process from 'child_process';
import * as readline from 'readline';
import { Command } from 'commander';
import { getWebApi } from '../../api/client.js';
import { getConfig, getOrgUrl, loadConfigFile, getRemoteContext, parseAdoRemoteUrl } from '../../config/index.js';
import { listStoredOrgs } from '../../auth/store.js';
import { AdoError, ConfigError } from '../../errors/index.js';

// ─── Arg parsing ──────────────────────────────────────────────────────────────

type ParsedRepoArg =
  | { type: 'clone-url'; cloneUrl: string }
  | { type: 'project-repo'; project: string; repo: string }
  | { type: 'single'; name: string };

/**
 * Interprets the first positional argument to `ado repo clone`:
 *
 *  - Any HTTPS URL or SSH remote → `clone-url`, passed straight to `git clone`
 *    without an API lookup.
 *  - `<project>/<repo>` → `project-repo`; org still comes from config/flags.
 *  - A plain name → `single`; resolved as a repo name when a default project is
 *    configured, or as both project *and* repo name otherwise.
 */
function parseRepoArg(arg: string): ParsedRepoArg {
  if (arg.includes('://') || arg.includes('@')) {
    return { type: 'clone-url', cloneUrl: arg };
  }
  if (arg.includes('/')) {
    const slash = arg.indexOf('/');
    return { type: 'project-repo', project: arg.slice(0, slash), repo: arg.slice(slash + 1) };
  }
  return { type: 'single', name: arg };
}

function hasConfiguredProject(override?: string): boolean {
  return !!(
    override ||
    process.env['AZURE_DEVOPS_PROJECT'] ||
    getRemoteContext().project ||
    loadConfigFile().project
  );
}

// ─── Readline helpers ─────────────────────────────────────────────────────────

function createRl(): readline.Interface {
  return readline.createInterface({ input: process.stdin, output: process.stderr });
}

async function promptSelect(rl: readline.Interface, label: string, choices: string[]): Promise<string> {
  choices.forEach((c, i) => process.stderr.write(`  ${i + 1}) ${c}\n`));
  return new Promise((resolve) => {
    const ask = () => {
      rl.question(`${label} [1-${choices.length}]: `, (answer) => {
        const n = parseInt(answer.trim(), 10);
        if (n >= 1 && n <= choices.length) {
          resolve(choices[n - 1]);
        } else {
          process.stderr.write(`  Please enter a number between 1 and ${choices.length}.\n`);
          ask();
        }
      });
    };
    ask();
  });
}

async function promptInput(rl: readline.Interface, label: string, defaultValue?: string): Promise<string> {
  const hint = defaultValue ? ` [${defaultValue}]` : '';
  return new Promise((resolve) => {
    rl.question(`${label}${hint}: `, (answer) => {
      resolve(answer.trim() || defaultValue || '');
    });
  });
}

// ─── Interactive resolution ───────────────────────────────────────────────────

async function resolveOrg(rl: readline.Interface, override?: string): Promise<string> {
  if (override) return override;
  if (process.env['AZURE_DEVOPS_ORG']) return process.env['AZURE_DEVOPS_ORG'];
  const remote = getRemoteContext();
  if (remote.orgUrl) return remote.orgUrl;
  const file = loadConfigFile();
  if (file.orgUrl) return file.orgUrl;

  const orgs = await listStoredOrgs();
  if (orgs.length === 0) {
    throw new ConfigError(
      'No organization configured. Run: ado auth login',
    );
  }
  if (orgs.length === 1) return orgs[0];

  process.stderr.write('\nSelect organization:\n');
  return promptSelect(rl, 'Organization', orgs);
}

async function resolveProject(rl: readline.Interface, orgUrl: string, override?: string): Promise<string> {
  if (override) return override;
  if (process.env['AZURE_DEVOPS_PROJECT']) return process.env['AZURE_DEVOPS_PROJECT'];
  const remote = getRemoteContext();
  if (remote.project) return remote.project;
  const file = loadConfigFile();
  if (file.project) return file.project;

  const connection = await getWebApi(orgUrl);
  const coreApi = await connection.getCoreApi();
  const projects = (await coreApi.getProjects()) ?? [];
  const names = projects.map((p) => p.name ?? '').filter(Boolean).sort();

  if (names.length === 0) throw new AdoError('No projects found in this organization.');
  if (names.length === 1) return names[0];

  process.stderr.write('\nSelect project:\n');
  return promptSelect(rl, 'Project', names);
}

async function resolveRepo(
  rl: readline.Interface,
  orgUrl: string,
  project: string,
  repoArg?: string,
): Promise<{ name: string; remoteUrl: string }> {
  const connection = await getWebApi(orgUrl);
  const gitApi = await connection.getGitApi();

  if (repoArg) {
    const repoInfo = await gitApi.getRepository(repoArg, project);
    if (!repoInfo) throw new AdoError(`Repository '${repoArg}' not found in project '${project}'.`);
    if (!repoInfo.remoteUrl) throw new AdoError(`Repository '${repoArg}' has no remote URL.`);
    return { name: repoInfo.name ?? repoArg, remoteUrl: repoInfo.remoteUrl };
  }

  const repos = (await gitApi.getRepositories(project)) ?? [];
  const sorted = repos
    .filter((r) => r.name && r.remoteUrl)
    .sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''));

  if (sorted.length === 0) throw new AdoError(`No repositories found in project '${project}'.`);
  if (sorted.length === 1) {
    const r = sorted[0];
    process.stderr.write(`\nOnly one repository found: ${r.name}\n`);
    return { name: r.name!, remoteUrl: r.remoteUrl! };
  }

  process.stderr.write('\nSelect repository:\n');
  const names = sorted.map((r) => r.name!);
  const chosen = await promptSelect(rl, 'Repository', names);
  const pick = sorted.find((r) => r.name === chosen)!;
  return { name: pick.name!, remoteUrl: pick.remoteUrl! };
}

async function promptAndClone(
  rl: readline.Interface,
  remoteUrl: string,
  repoName: string,
  directoryArg: string | undefined,
): Promise<void> {
  const directory = await promptInput(rl, '\nTarget directory', directoryArg ?? repoName);
  const extraInput = await promptInput(rl, 'Extra git clone arguments (optional)');
  const extraArgs = extraInput ? extraInput.split(/\s+/).filter(Boolean) : [];
  const args = ['clone', ...extraArgs, remoteUrl, ...(directory ? [directory] : [])];
  process.stderr.write(`\nRunning: git ${args.join(' ')}\n\n`);
  await spawnGit(args);
}

// ─── Non-interactive clone ────────────────────────────────────────────────────

async function cloneNonInteractive(
  repoArg: string,
  directoryArg: string | undefined,
  options: { project?: string; org?: string },
): Promise<void> {
  const parsed = parseRepoArg(repoArg);

  // ── Full URL (HTTPS or SSH) ──────────────────────────────────────────────
  // Clone directly without an API lookup — auth is handled by the git
  // credential manager (same as running `git clone <url>` by hand).
  if (parsed.type === 'clone-url') {
    const args = ['clone', parsed.cloneUrl];
    if (directoryArg) args.push(directoryArg);
    return spawnGit(args);
  }

  // ── project/repo ─────────────────────────────────────────────────────────
  if (parsed.type === 'project-repo') {
    const orgUrl = getOrgUrl(options.org);
    const connection = await getWebApi(orgUrl);
    const gitApi = await connection.getGitApi();
    const repoInfo = await gitApi.getRepository(parsed.repo, parsed.project);
    if (!repoInfo) throw new AdoError(`Repository '${parsed.repo}' not found in project '${parsed.project}'.`);
    if (!repoInfo.remoteUrl) throw new AdoError(`Repository '${parsed.repo}' has no remote URL.`);
    const args = ['clone', repoInfo.remoteUrl];
    if (directoryArg) args.push(directoryArg);
    return spawnGit(args);
  }

  // ── Single name ───────────────────────────────────────────────────────────
  // Project configured → treat as a repo name in that project.
  // Project NOT configured → treat as both project name and repo name.
  if (hasConfiguredProject(options.project)) {
    const config = getConfig({ orgUrl: options.org, project: options.project });
    const connection = await getWebApi(config.orgUrl);
    const gitApi = await connection.getGitApi();
    const repoInfo = await gitApi.getRepository(parsed.name, config.project);
    if (!repoInfo) throw new AdoError(`Repository '${parsed.name}' not found in project '${config.project}'.`);
    if (!repoInfo.remoteUrl) throw new AdoError(`Repository '${parsed.name}' has no remote URL.`);
    const args = ['clone', repoInfo.remoteUrl];
    if (directoryArg) args.push(directoryArg);
    return spawnGit(args);
  } else {
    const orgUrl = getOrgUrl(options.org);
    const connection = await getWebApi(orgUrl);
    const gitApi = await connection.getGitApi();
    const repoInfo = await gitApi.getRepository(parsed.name, parsed.name);
    if (!repoInfo) {
      throw new AdoError(
        `Repository '${parsed.name}' not found in project '${parsed.name}'.\n` +
        `Hint: use 'ado repo clone <project>/<repo>' to specify different names.`,
      );
    }
    if (!repoInfo.remoteUrl) throw new AdoError(`Repository '${parsed.name}' has no remote URL.`);
    const args = ['clone', repoInfo.remoteUrl];
    if (directoryArg) args.push(directoryArg);
    return spawnGit(args);
  }
}

// ─── Handler ──────────────────────────────────────────────────────────────────

async function repoCloneHandler(
  repoArg: string | undefined,
  directoryArg: string | undefined,
  options: { project?: string; org?: string },
): Promise<void> {
  const isInteractive = process.stdin.isTTY;

  if (!isInteractive) {
    if (!repoArg) throw new AdoError('Repository name is required (non-interactive mode).');
    return cloneNonInteractive(repoArg, directoryArg, options);
  }

  // Interactive path
  const rl = createRl();
  try {
    const parsed = repoArg ? parseRepoArg(repoArg) : null;

    // URL: clone directly, only ask for directory and extra args
    if (parsed?.type === 'clone-url') {
      const urlRepo = parseAdoRemoteUrl(parsed.cloneUrl);
      const repoName = urlRepo?.repo ?? parsed.cloneUrl.split('/').pop()?.replace(/\.git$/, '') ?? '';
      await promptAndClone(rl, parsed.cloneUrl, repoName, directoryArg);
      return;
    }

    const orgUrl = await resolveOrg(rl, options.org);

    // project/repo: skip project prompt, look up repo directly
    if (parsed?.type === 'project-repo') {
      const { name: repoName, remoteUrl } = await resolveRepo(rl, orgUrl, parsed.project, parsed.repo);
      await promptAndClone(rl, remoteUrl, repoName, directoryArg);
      return;
    }

    // single name or no arg: full interactive flow
    const project = await resolveProject(rl, orgUrl, options.project);
    const singleName = parsed?.type === 'single' ? parsed.name : undefined;
    const { name: repoName, remoteUrl } = await resolveRepo(rl, orgUrl, project, singleName);
    await promptAndClone(rl, remoteUrl, repoName, directoryArg);
  } finally {
    rl.close();
  }
}

function spawnGit(args: string[]): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const proc = child_process.spawn('git', args, { stdio: 'inherit' });
    proc.on('close', (code) =>
      code === 0 ? resolve() : reject(new AdoError(`git clone failed with exit code ${code}`)),
    );
    proc.on('error', (err) => reject(new AdoError(`Failed to run git: ${err.message}`)));
  });
}

export function registerRepoClone(repoCmd: Command): void {
  repoCmd
    .command('clone [repo] [directory]')
    .description('Clone a repository locally (interactive when arguments are omitted)')
    .option('-p, --project <project>', 'Azure DevOps project (overrides config)')
    .option('--org <url>', 'Azure DevOps organization URL (overrides config)')
    .action(repoCloneHandler);
}
