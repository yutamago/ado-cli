import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { execSync } from 'child_process';
import { ConfigError } from '../errors/index.js';
import { error } from 'console';

export interface RemoteContext {
  orgUrl?: string;
  org?: string;
  project?: string;
  repo?: string;
}

/**
 * Parses an Azure DevOps remote URL and returns orgUrl, project, and repo.
 *
 * Supported formats:
 *   https://dev.azure.com/{org}/{project}/_git/{repo}
 *   https://{org}.visualstudio.com/{project}/_git/{repo}
 *   git@ssh.dev.azure.com:v3/{org}/{project}/{repo}
 *   {org}@vs-ssh.visualstudio.com:v3/{org}/{project}/{repo}
 */
export function parseAdoRemoteUrl(remoteUrl: string): RemoteContext | null {
  // HTTPS: https://dev.azure.com/{org}/{project}/_git/{repo}
  // HTTPS: https://{org}@dev.azure.com/{org}/{project}/_git/{repo}
  let m = remoteUrl.match(/^https?:\/\/(?:[^@]+@)?dev\.azure\.com\/([^\/]+)\/([^\/]+)\/_git\/([^\/?#\s]+)(?:\/.*)?$/);
  if (m) return { orgUrl: `https://dev.azure.com/${m[1]}`, org: m[1], project: m[2], repo: m[3] };

  // HTTPS legacy: https://{org}.visualstudio.com/{project}/_git/{repo}
  // HTTPS legacy: https://{org}@{org}.visualstudio.com/{project}/_git/{repo}
  m = remoteUrl.match(/^https?:\/\/(?:[^@]+@)?([^.]+)\.visualstudio\.com\/([^\/]+)\/_git\/([^\/?#\s]+)(?:\/.*)?$/);
  if (m) return { orgUrl: `https://${m[1]}.visualstudio.com`, org: m[1], project: m[2], repo: m[3] };

  // SSH: {org}@ssh.dev.azure.com:{version}/{org}/{project}/{repo}
  m = remoteUrl.match(/^[^@]+@ssh\.dev\.azure\.com(?::[^\/]+)?\/([^\/]+)\/([^\/]+)\/([^\/?#\s]+)(?:\/.*)?$/);
  if (m) return { orgUrl: `https://dev.azure.com/${m[1]}`, org: m[1], project: m[2], repo: m[3] };

  // SSH legacy: {org}@vs-ssh.visualstudio.com:{version}/{org}/{project}/{repo}
  m = remoteUrl.match(/^[^@]+@vs-ssh\.visualstudio\.com(?::[^\/]+)?\/([^\/]+)\/([^\/]+)\/([^\/?#\s]+)(?:\/.*)?$/);
  if (m) return { orgUrl: `https://${m[1]}.visualstudio.com`, org: m[1], project: m[2], repo: m[3] };

  return null;
}

let remoteContextCache: RemoteContext | null = null;
export function getRemoteContext(): RemoteContext {
  if (remoteContextCache)
    return remoteContextCache;

  try {
    const remoteUrl = execSync('git remote get-url origin', { stdio: ['pipe', 'pipe', 'pipe'] })
      .toString()
      .trim();
    remoteContextCache = parseAdoRemoteUrl(remoteUrl) ?? {};
    return remoteContextCache;
  } catch(e) {
    console.error(`Failed to get git remote URL from directory ${process.cwd()}: ${(e as Error).message}`);

    return {};
  }
}

export interface AdoConfig {
  orgUrl: string;
  project: string;
}

const CONFIG_DIR = path.join(os.homedir(), '.ado');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

export function getConfigDir(): string {
  return CONFIG_DIR;
}

export function loadConfigFile(): Partial<AdoConfig> {
  try {
    const raw = fs.readFileSync(CONFIG_FILE, 'utf8');
    return JSON.parse(raw) as Partial<AdoConfig>;
  } catch {
    return {};
  }
}

export function saveConfigFile(config: Partial<AdoConfig>): void {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  const existing = loadConfigFile();
  const merged = { ...existing, ...config };
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(merged, null, 2), 'utf8');
}

export function getConfig(overrides?: Partial<AdoConfig>): AdoConfig {
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
      'No organization configured (checked flags, AZURE_DEVOPS_ORG, git remote, and ~/.ado/config.json).\n' +
      'Run: ado auth login\n' +
      'Or set AZURE_DEVOPS_ORG environment variable.'
    );
  }
  if (!project) {
    throw new ConfigError(
      'No project configured (checked flags, AZURE_DEVOPS_PROJECT, git remote, and ~/.ado/config.json).\n' +
      'Run: ado auth login\n' +
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
      'No organization configured (checked flags, AZURE_DEVOPS_ORG, git remote, and ~/.ado/config.json).\n' +
      'Run: ado auth login\n' +
      'Or set AZURE_DEVOPS_ORG environment variable.'
    );
  }
  return url;
}
