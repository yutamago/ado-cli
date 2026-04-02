import * as fs from 'fs';
import * as path from 'path';
import { Command } from 'commander';
import { getOrgUrl, getConfigDir, loadConfigFile } from '../../config/index.js';
import { deleteCredential } from '../../auth/store.js';
import { AzdError } from '../../errors/index.js';

async function authLogoutHandler(options: { org?: string }): Promise<void> {
  let orgUrl: string;
  try {
    orgUrl = getOrgUrl(options.org);
  } catch {
    throw new AzdError('Not authenticated. Run: ado auth login');
  }

  await deleteCredential(orgUrl);

  // Clear org+project from config if it matches
  const config = loadConfigFile();
  if (config.orgUrl === orgUrl) {
    const configFile = path.join(getConfigDir(), 'config.json');
    try {
      fs.writeFileSync(configFile, JSON.stringify({}, null, 2), 'utf8');
    } catch {
      // ignore write errors
    }
  }

  process.stdout.write(`Logged out of ${orgUrl}\n`);
}

export function registerAuthLogout(authCmd: Command): void {
  authCmd
    .command('logout')
    .description('Log out of an Azure DevOps organization')
    .option('--org <url>', 'Azure DevOps organization URL')
    .action(authLogoutHandler);
}
