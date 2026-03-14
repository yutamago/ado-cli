import { Command } from 'commander';
import * as readline from 'readline';
import { saveToken } from '../../auth/store.js';
import { saveConfigFile } from '../../config/index.js';
import { AzdError } from '../../errors/index.js';

function prompt(question: string, secret = false): Promise<string> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    if (secret) {
      // Suppress echo on TTY
      process.stdout.write(question);
      process.stdin.setRawMode?.(true);
      let input = '';
      process.stdin.resume();
      process.stdin.setEncoding('utf8');
      const onData = (ch: string) => {
        if (ch === '\n' || ch === '\r' || ch === '\u0003') {
          process.stdin.setRawMode?.(false);
          process.stdin.removeListener('data', onData);
          process.stdout.write('\n');
          rl.close();
          resolve(input);
        } else if (ch === '\u007f' || ch === '\b') {
          input = input.slice(0, -1);
        } else {
          input += ch;
        }
      };
      process.stdin.on('data', onData);
    } else {
      rl.question(question, (answer) => {
        rl.close();
        resolve(answer.trim());
      });
    }
  });
}

async function loginHandler(options: { token?: string; org?: string; project?: string }): Promise<void> {
  let orgUrl = options.org;
  let token = options.token;

  if (!orgUrl) {
    orgUrl = await prompt('Enter your Azure DevOps organization URL (e.g. https://dev.azure.com/myorg): ');
  }

  // Normalize org URL
  orgUrl = orgUrl.replace(/\/$/, '');

  if (!token) {
    // Open browser to PAT creation page
    try {
      const openMod = await import('open');
      const open = openMod.default;
      const tokenUrl = `${orgUrl}/_usersSettings/tokens`;
      process.stdout.write(`Opening browser to create a Personal Access Token:\n  ${tokenUrl}\n\n`);
      await open(tokenUrl);
    } catch {
      // Ignore if open fails (headless environment)
    }

    token = await prompt('Enter your Personal Access Token: ', true);
  }

  token = token.trim();
  if (!token) {
    throw new AzdError('No token provided.');
  }

  // Validate the token
  process.stdout.write('Validating token...\n');
  const azdev = await import('azure-devops-node-api');
  const authHandler = azdev.getPersonalAccessTokenHandler(token);
  const connection = new azdev.WebApi(orgUrl, authHandler);

  let displayName = '';
  try {
    const connData = await connection.connect();
    displayName = connData?.authenticatedUser?.providerDisplayName ?? connData?.authenticatedUser?.subjectDescriptor ?? '';
  } catch (err: unknown) {
    const status = err && typeof err === 'object' && 'statusCode' in err
      ? (err as { statusCode: number }).statusCode
      : 0;
    if (status === 401 || status === 203) {
      throw new AzdError('Authentication failed: invalid or expired token.');
    }
    throw new AzdError(`Failed to connect to ${orgUrl}: ${err instanceof Error ? err.message : String(err)}`);
  }

  // Save credentials
  await saveToken(orgUrl, token);

  // Save org to config
  const configUpdate: { orgUrl: string; project?: string } = { orgUrl };
  let defaultProject = options.project;

  if (!defaultProject) {
    try {
      const coreApi = await connection.getCoreApi();
      const projects = await coreApi.getProjects();
      if (projects && projects.length === 1) {
        defaultProject = projects[0].name ?? undefined;
      } else if (projects && projects.length > 1) {
        process.stdout.write('\nAvailable projects:\n');
        projects.forEach((p, i) => process.stdout.write(`  ${i + 1}. ${p.name}\n`));
        const answer = await prompt('\nDefault project name (leave blank to skip): ');
        if (answer) defaultProject = answer;
      }
    } catch {
      // Non-fatal — user can set project later
    }
  }

  if (defaultProject) {
    configUpdate.project = defaultProject;
  }

  saveConfigFile(configUpdate);

  const who = displayName ? ` as ${displayName}` : '';
  process.stdout.write(`Logged in to ${orgUrl}${who}\n`);
  if (defaultProject) {
    process.stdout.write(`Default project: ${defaultProject}\n`);
  }
}

export function registerAuthCommands(program: Command): void {
  const auth = program.command('auth').description('Authenticate with Azure DevOps');

  auth
    .command('login')
    .description('Authenticate with an Azure DevOps organization')
    .option('--org <url>', 'Azure DevOps organization URL')
    .option('--project <name>', 'Default project name')
    .option('--token <token>', 'Personal Access Token (skip interactive prompt)')
    .action(loginHandler);
}
