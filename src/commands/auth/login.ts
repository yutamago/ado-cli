import { Command } from 'commander';
import * as readline from 'readline';
import { savePatToken, saveOAuthCredential } from '../../auth/store.js';
import { loginBrowser, loginDeviceCode } from '../../auth/oauth.js';
import { saveConfigFile, getRemoteContext } from '../../config/index.js';
import { AdoError } from '../../errors/index.js';
import { registerAuthStatus } from './status.js';
import { registerAuthLogout } from './logout.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function promptLine(question: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

function readStdin(): Promise<string> {
  return new Promise((resolve) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => { data += chunk; });
    process.stdin.on('end', () => { resolve(data.trim()); });
    process.stdin.resume();
  });
}

async function validateAndSave(
  orgUrl: string,
  token: string,
  tokenType: 'pat' | 'bearer',
  project?: string,
): Promise<void> {
  process.stdout.write('Validating token...\n');

  const azdev = await import('azure-devops-node-api');
  const handler = tokenType === 'bearer'
    ? azdev.getBearerHandler(token)
    : azdev.getPersonalAccessTokenHandler(token);
  const connection = new azdev.WebApi(orgUrl, handler);

  let displayName = '';
  try {
    const connData = await connection.connect();
    displayName =
      connData?.authenticatedUser?.providerDisplayName ??
      connData?.authenticatedUser?.subjectDescriptor ??
      '';
  } catch (err: unknown) {
    const status =
      err && typeof err === 'object' && 'statusCode' in err
        ? (err as { statusCode: number }).statusCode
        : 0;
    if (status === 401 || status === 203) {
      throw new AdoError('Authentication failed: invalid or expired token.');
    }
    throw new AdoError(
      `Failed to connect to ${orgUrl}: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  // Persist the credential
  if (tokenType === 'bearer') {
    // OAuth: the MSAL cache already holds the refresh token. Just mark the org as oauth.
    await saveOAuthCredential(orgUrl);
  } else {
    await savePatToken(orgUrl, token);
  }

  // Save org + optional default project to config
  const configUpdate: { orgUrl: string; project?: string } = { orgUrl };
  let defaultProject = project;

  if (!defaultProject) {
    try {
      const coreApi = await connection.getCoreApi();
      const projects = await coreApi.getProjects();
      if (projects && projects.length === 1) {
        defaultProject = projects[0].name ?? undefined;
      } else if (projects && projects.length > 1) {
        process.stdout.write('\nAvailable projects:\n');
        if (process.stdout.isTTY) {
          projects.forEach((p, i) => process.stdout.write(`  ${i + 1}. ${p.name}\n`));
          const answer = await promptLine(`\nSelect project (1-${projects.length}) or press Enter to skip: `);
          const idx = parseInt(answer, 10);
          if (!isNaN(idx) && idx >= 1 && idx <= projects.length) {
            defaultProject = projects[idx - 1].name ?? undefined;
          } else if (answer && isNaN(idx)) {
            // User typed a project name directly
            defaultProject = answer;
          }
        } else {
          projects.forEach((p) => process.stdout.write(`  ${p.name}\n`));
          const answer = await promptLine('\nDefault project name (leave blank to skip): ');
          if (answer) defaultProject = answer;
        }
      }
    } catch {
      // Non-fatal — user can set project later via --project flag or env var
    }
  }

  if (defaultProject) configUpdate.project = defaultProject;
  saveConfigFile(configUpdate);

  const who = displayName ? ` as ${displayName}` : '';
  process.stdout.write(`Logged in to ${orgUrl}${who}\n`);
  if (defaultProject) process.stdout.write(`Default project: ${defaultProject}\n`);
}

// ─── OAuth flow ───────────────────────────────────────────────────────────────

async function oauthLogin(orgUrl: string, project?: string): Promise<void> {
  // Use device code in headless environments (no TTY = likely CI or piped)
  const isHeadless = !process.stdout.isTTY;

  if (isHeadless) {
    process.stdout.write('No TTY detected — using device code flow.\n');
    process.stdout.write('Follow the instructions below to authenticate:\n');
    const token = await loginDeviceCode();
    await validateAndSave(orgUrl, token, 'bearer', project);
  } else {
    process.stdout.write('Opening your browser to complete authentication...\n');
    const token = await loginBrowser();
    await validateAndSave(orgUrl, token, 'bearer', project);
  }
}

// ─── PAT flow ─────────────────────────────────────────────────────────────────

async function patLogin(orgUrl: string, token: string | undefined, project?: string): Promise<void> {
  let pat = token;

  if (!pat) {
    if (!process.stdin.isTTY) {
      // Read token from stdin (e.g. echo $PAT | ado auth login --with-token)
      pat = await readStdin();
    } else {
      // Interactive prompt — open browser to PAT creation page first
      try {
        const openMod = await import('open');
        const open = openMod.default;
        const tokenUrl = `${orgUrl}/_usersSettings/tokens`;
        process.stdout.write(`Opening browser to create a Personal Access Token:\n  ${tokenUrl}\n\n`);
        await open(tokenUrl);
      } catch {
        // Ignore — headless environment
      }
      pat = await promptLine('Enter your Personal Access Token: ');
    }
  }

  pat = pat.trim();
  if (!pat) throw new AdoError('No token provided.');

  await validateAndSave(orgUrl, pat, 'pat', project);
}

// ─── Command handler ──────────────────────────────────────────────────────────

async function loginHandler(options: {
  withToken?: boolean;
  token?: string;
  org?: string;
  project?: string;
}): Promise<void> {
  let orgUrl = options.org ?? getRemoteContext().orgUrl;
  let project = options.project ?? getRemoteContext().project;

  if (!orgUrl) {
    if (!process.stdin.isTTY && !options.withToken) {
      // Non-interactive and no --with-token: can't prompt for org URL
      throw new AdoError(
        'No organization URL provided. Use --org <url> or set AZURE_DEVOPS_ORG.',
      );
    }
    orgUrl = await promptLine(
      'Enter your Azure DevOps organization URL (e.g. https://dev.azure.com/myorg): ',
    );
  }

  // Normalize
  orgUrl = orgUrl.replace(/\/$/, '');

  const usePatFlow = options.withToken === true || options.token !== undefined;

  if (usePatFlow) {
    await patLogin(orgUrl, options.token, project);
  } else {
    await oauthLogin(orgUrl, project);
  }
}

// ─── Registration ─────────────────────────────────────────────────────────────

export function registerAuthCommands(program: Command): void {
  const auth = program.command('auth').description('Authenticate with Azure DevOps');

  registerAuthStatus(auth);
  registerAuthLogout(auth);

  auth
    .command('login')
    .description(
      'Authenticate with an Azure DevOps organization.\n' +
      'Default: interactive OAuth via browser (or device code in headless environments).\n' +
      'Use --with-token to authenticate with a Personal Access Token instead.',
    )
    .option('--org <url>', 'Azure DevOps organization URL')
    .option('--project <name>', 'Default project name')
    .option(
      '--with-token',
      'Authenticate with a Personal Access Token (reads from stdin if not a TTY)',
    )
    .option('--token <token>', 'Personal Access Token value (implies --with-token)')
    .action(loginHandler);
}
