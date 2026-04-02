import { Command } from 'commander';
import { getOrgUrl, loadConfigFile } from '../../config/index.js';
import { loadCredential } from '../../auth/store.js';
import { getWebApi } from '../../api/client.js';
import { outputDetail, outputJson } from '../../output/index.js';

async function authStatusHandler(options: { org?: string; json?: string | boolean }): Promise<void> {
  let orgUrl: string;
  try {
    orgUrl = getOrgUrl(options.org);
  } catch {
    if (options.json !== undefined) {
      outputJson({ authenticated: false });
    } else {
      process.stdout.write('Not authenticated. Run: ado auth login\n');
    }
    return;
  }

  const cred = await loadCredential(orgUrl);
  if (!cred) {
    if (options.json !== undefined) {
      outputJson({ authenticated: false, orgUrl });
    } else {
      process.stdout.write(`Not authenticated for ${orgUrl}. Run: ado auth login\n`);
    }
    return;
  }

  let username = '';
  try {
    const connection = await getWebApi(orgUrl);
    const connData = await connection.connect();
    username =
      connData?.authenticatedUser?.providerDisplayName ??
      connData?.authenticatedUser?.subjectDescriptor ??
      '';
  } catch {
    // non-fatal — show status even if we can't reach the server
  }

  const config = loadConfigFile();

  if (options.json !== undefined) {
    outputJson(
      { authenticated: true, orgUrl, authType: cred.type, username, defaultProject: config.project ?? '' },
      typeof options.json === 'string' ? options.json : undefined,
    );
    return;
  }

  outputDetail([
    ['org', orgUrl],
    ['auth type', cred.type],
    ['username', username],
    ['default project', config.project ?? '(not set)'],
  ]);
}

export function registerAuthStatus(authCmd: Command): void {
  authCmd
    .command('status')
    .description('View authentication status')
    .option('--org <url>', 'Azure DevOps organization URL')
    .option('--json [fields]', 'Output as JSON')
    .action(authStatusHandler);
}
