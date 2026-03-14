import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { ConfigError } from '../errors/index.js';

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

  const orgUrl =
    overrides?.orgUrl ??
    process.env['AZURE_DEVOPS_ORG'] ??
    file.orgUrl;

  const project =
    overrides?.project ??
    process.env['AZURE_DEVOPS_PROJECT'] ??
    file.project;

  if (!orgUrl) {
    throw new ConfigError(
      'No organization configured. Run: azd auth login\n' +
      'Or set AZURE_DEVOPS_ORG environment variable.'
    );
  }
  if (!project) {
    throw new ConfigError(
      'No project configured. Run: azd auth login\n' +
      'Or set AZURE_DEVOPS_PROJECT environment variable.'
    );
  }

  return { orgUrl, project };
}

export function getOrgUrl(override?: string): string {
  const url =
    override ??
    process.env['AZURE_DEVOPS_ORG'] ??
    loadConfigFile().orgUrl;

  if (!url) {
    throw new ConfigError(
      'No organization configured. Run: azd auth login\n' +
      'Or set AZURE_DEVOPS_ORG environment variable.'
    );
  }
  return url;
}
