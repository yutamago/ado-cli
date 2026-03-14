import * as fs from 'fs';
import * as path from 'path';
import { getConfigDir } from '../config/index.js';

const KEYTAR_SERVICE = 'azd-cli';
const CREDENTIALS_FILE = path.join(getConfigDir(), 'credentials.json');

type CredentialStore = Record<string, string>;

function readCredentialsFile(): CredentialStore {
  try {
    const raw = fs.readFileSync(CREDENTIALS_FILE, 'utf8');
    return JSON.parse(raw) as CredentialStore;
  } catch {
    return {};
  }
}

function writeCredentialsFile(store: CredentialStore): void {
  const dir = path.dirname(CREDENTIALS_FILE);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(CREDENTIALS_FILE, JSON.stringify(store, null, 2), { encoding: 'utf8', mode: 0o600 });
}

export async function saveToken(orgUrl: string, token: string): Promise<void> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const keytar = require('keytar') as typeof import('keytar');
    await keytar.setPassword(KEYTAR_SERVICE, orgUrl, token);
    return;
  } catch {
    // keytar unavailable, fall back to file
  }
  const store = readCredentialsFile();
  store[orgUrl] = token;
  writeCredentialsFile(store);
  process.stderr.write('Warning: keytar not available. Credentials stored in plain text at ' + CREDENTIALS_FILE + '\n');
}

export async function loadToken(orgUrl?: string): Promise<string | null> {
  // Highest priority: explicit env var
  if (process.env['AZURE_DEVOPS_TOKEN']) {
    return process.env['AZURE_DEVOPS_TOKEN'];
  }

  if (!orgUrl) {
    // Try to load from file store (any key)
    const store = readCredentialsFile();
    const keys = Object.keys(store);
    if (keys.length > 0) return store[keys[0]] ?? null;
    return null;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const keytar = require('keytar') as typeof import('keytar');
    const token = await keytar.getPassword(KEYTAR_SERVICE, orgUrl);
    if (token) return token;
  } catch {
    // keytar unavailable
  }

  const store = readCredentialsFile();
  return store[orgUrl] ?? null;
}

export async function deleteToken(orgUrl: string): Promise<void> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const keytar = require('keytar') as typeof import('keytar');
    await keytar.deletePassword(KEYTAR_SERVICE, orgUrl);
  } catch {
    // keytar unavailable
  }
  const store = readCredentialsFile();
  delete store[orgUrl];
  writeCredentialsFile(store);
}
