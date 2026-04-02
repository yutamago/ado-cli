import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { execSync } from 'child_process';
import { ConfigError } from '../errors/index.js';

/**
 * Parses an Azure DevOps remote URL and returns orgUrl + project.
 *
 * Supported formats:
 *   https://dev.azure.com/{org}/{project}/_git/{repo}
 *   https://{org}.visualstudio.com/{project}/_git/{repo}
 *   git@ssh.dev.azure.com:v3/{org}/{project}/{repo}
 *   {org}@vs-ssh.visualstudio.com:v3/{org}/{project}/{repo}
 */
export function parseAzdRemoteUrl(remoteUrl: string): Partial<AzdConfig> | null {
  // HTTPS: https://dev.azure.com/{org}/{project}/_git/{repo}
  let m = remoteUrl.match(/^https?:\/\/dev\.azure\.com\/([^/]+)\/([^/]+)\//);
  if (m) return { orgUrl: `https://dev.azure.com/${m[1]}`, project: m[2] };

  // HTTPS legacy: https://{org}.visualstudio.com/{project}/_git/{repo}
  m = remoteUrl.match(/^https?:\/\/([^.]+)\.visualstudio\.com\/([^/]+)\//);
  if (m) return { orgUrl: `https://${m[1]}.visualstudio.com`, project: m[2] };

  // SSH: git@ssh.dev.azure.com:v3/{org}/{project}/{repo}
  m = remoteUrl.match(/^git@ssh\.dev\.azure\.com:v3\/([^/]+)\/([^/]+)\//);
  if (m) return { orgUrl: `https://dev.azure.com/${m[1]}`, project: m[2] };

  // SSH legacy: {org}@vs-ssh.visualstudio.com:v3/{org}/{project}/{repo}
  m = remoteUrl.match(/^[^@]+@vs-ssh\.visualstudio\.com:v3\/([^/]+)\/([^/]+)\//);
  if (m) return { orgUrl: `https://${m[1]}.visualstudio.com`, project: m[2] };

  return null;
}

function getRemoteContext(): Partial<AzdConfig> {
  try {
    const remoteUrl = execSync('git remote get-url origin', { stdio: ['pipe', 'pipe', 'pipe'] })
      .toString()
      .trim();
    return parseAzdRemoteUrl(remoteUrl) ?? {};
  } catch {
    return {};
  }
}

export interface AzdConfig {
  orgUrl: string;
  project: string;
}

const CONFIG_DIR = path.join(os.homedir(), '.azd');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

export function getConfigDir(): string {
  return CONFIG_DIR;
}

export function loadConfigFile(): Partial<AzdConfig> {
  try {
    const raw = fs.readFileSync(CONFIG_FILE, 'utf8');
    return JSON.parse(raw) as Partial<AzdConfig>;
  } catch {
    return {};
  }
}

export function saveConfigFile(config: Partial<AzdConfig>): void {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  const existing = loadConfigFile();
  const merged = { ...existing, ...config };
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(merged, null, 2), 'utf8');
}

export function getConfig(overrides?: Partial<AzdConfig>): AzdConfig {
  const file = loadConfigFile();
  const remote = getRemoteContext();

  const orgUrl =
    overrides?.orgUrl ??
    process.env['AZURE_DEVOPS_ORG'] ??
    remote.orgUrl ??
    file.orgUrl;

  const project =
    overrides?.project ??
    process.env['AZURE_DEVOPS_PROJECT'] ??
    remote.project ??
    file.project;

  if (!orgUrl) {
    throw new ConfigError(
      'No organization configured. Run: ado auth login\n' +
      'Or set AZURE_DEVOPS_ORG environment variable.'
    );
  }
  if (!project) {
    throw new ConfigError(
      'No project configured. Run: ado auth login\n' +
      'Or set AZURE_DEVOPS_PROJECT environment variable.'
    );
  }

  return { orgUrl, project };
}

export function getOrgUrl(override?: string): string {
  const url =
    override ??
    process.env['AZURE_DEVOPS_ORG'] ??
    getRemoteContext().orgUrl ??
    loadConfigFile().orgUrl;

  if (!url) {
    throw new ConfigError(
      'No organization configured. Run: ado auth login\n' +
      'Or set AZURE_DEVOPS_ORG environment variable.'
    );
  }
  return url;
}
