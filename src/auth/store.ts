import * as fs from 'fs';
import * as path from 'path';
import { getConfigDir } from '../config/index.js';

const KEYTAR_SERVICE = 'ado-cli';
const KEYTAR_OAUTH_CACHE_ACCOUNT = '__oauth_cache__';

const CREDENTIALS_FILE = path.join(getConfigDir(), 'credentials.json');
const OAUTH_CACHE_FILE = path.join(getConfigDir(), 'oauth-cache.json');

// ─── Credential types ────────────────────────────────────────────────────────

export type CredentialType = 'pat' | 'oauth';

interface StoredCredential {
  type: CredentialType;
  token?: string; // present for 'pat', absent for 'oauth' (token lives in MSAL cache)
}

// Credential file: Record<orgUrl, StoredCredential | string (legacy PAT)>
type CredentialStore = Record<string, StoredCredential | string>;

function readCredentialsFile(): CredentialStore {
  try {
    return JSON.parse(fs.readFileSync(CREDENTIALS_FILE, 'utf8')) as CredentialStore;
  } catch {
    return {};
  }
}

function writeCredentialsFile(store: CredentialStore): void {
  const dir = path.dirname(CREDENTIALS_FILE);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(CREDENTIALS_FILE, JSON.stringify(store, null, 2), {
    encoding: 'utf8',
    mode: 0o600,
  });
}

// ─── PAT storage ─────────────────────────────────────────────────────────────

export async function savePatToken(orgUrl: string, token: string): Promise<void> {
  const entry: StoredCredential = { type: 'pat', token };

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const keytar = require('keytar') as typeof import('keytar');
    // Store JSON-serialised credential so we can recover the type later
    await keytar.setPassword(KEYTAR_SERVICE, orgUrl, JSON.stringify(entry));
    return;
  } catch {
    // keytar unavailable
  }

  const store = readCredentialsFile();
  store[orgUrl] = entry;
  writeCredentialsFile(store);
  process.stderr.write(
    'Warning: keytar not available. Credentials stored in plain text at ' +
      CREDENTIALS_FILE +
      '\n',
  );
}

// ─── OAuth credential marker ──────────────────────────────────────────────────

/** Mark an org as using OAuth (the actual token lives in the MSAL cache). */
export async function saveOAuthCredential(orgUrl: string): Promise<void> {
  const entry: StoredCredential = { type: 'oauth' };

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const keytar = require('keytar') as typeof import('keytar');
    await keytar.setPassword(KEYTAR_SERVICE, orgUrl, JSON.stringify(entry));
    return;
  } catch {
    // keytar unavailable
  }

  const store = readCredentialsFile();
  store[orgUrl] = entry;
  writeCredentialsFile(store);
}

// ─── Load credential ──────────────────────────────────────────────────────────

export interface LoadedCredential {
  type: CredentialType;
  token?: string;
}

function parseEntry(raw: StoredCredential | string): LoadedCredential {
  // Legacy format: plain string → treat as PAT
  if (typeof raw === 'string') return { type: 'pat', token: raw };
  return raw;
}

export async function loadCredential(orgUrl?: string): Promise<LoadedCredential | null> {
  // Check keytar first
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const keytar = require('keytar') as typeof import('keytar');
    const raw = orgUrl
      ? await keytar.getPassword(KEYTAR_SERVICE, orgUrl)
      : null;

    if (raw) {
      try {
        return parseEntry(JSON.parse(raw) as StoredCredential | string);
      } catch {
        // Stored as plain string (very old format)
        return { type: 'pat', token: raw };
      }
    }
  } catch {
    // keytar unavailable
  }

  // Fall back to file
  const store = readCredentialsFile();

  if (orgUrl) {
    const entry = store[orgUrl];
    return entry !== undefined ? parseEntry(entry) : null;
  }

  // No specific orgUrl — return first entry found
  const first = Object.values(store)[0];
  return first !== undefined ? parseEntry(first) : null;
}

/** @deprecated Use loadCredential() — kept for backward compatibility. */
export async function loadToken(orgUrl?: string): Promise<string | null> {
  if (process.env['AZURE_DEVOPS_TOKEN']) return process.env['AZURE_DEVOPS_TOKEN'];
  const cred = await loadCredential(orgUrl);
  return cred?.token ?? null;
}

// ─── Delete credential ────────────────────────────────────────────────────────

export async function deleteCredential(orgUrl: string): Promise<void> {
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

// ─── OAuth MSAL cache ─────────────────────────────────────────────────────────

export async function saveOAuthCache(serialized: string): Promise<void> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const keytar = require('keytar') as typeof import('keytar');
    await keytar.setPassword(KEYTAR_SERVICE, KEYTAR_OAUTH_CACHE_ACCOUNT, serialized);
    return;
  } catch {
    // keytar unavailable
  }

  const dir = path.dirname(OAUTH_CACHE_FILE);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(OAUTH_CACHE_FILE, serialized, { encoding: 'utf8', mode: 0o600 });
}

/** Returns all org URLs that have stored credentials (PAT or OAuth marker). */
export async function listStoredOrgs(): Promise<string[]> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const keytar = require('keytar') as typeof import('keytar');
    const entries = await keytar.findCredentials(KEYTAR_SERVICE);
    const orgs = entries
      .map((e) => e.account)
      .filter((a) => a !== KEYTAR_OAUTH_CACHE_ACCOUNT);
    if (orgs.length > 0) return orgs.sort();
  } catch {
    // keytar unavailable, fall through
  }

  const store = readCredentialsFile();
  return Object.keys(store).sort();
}

export async function loadOAuthCache(): Promise<string | null> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const keytar = require('keytar') as typeof import('keytar');
    const cached = await keytar.getPassword(KEYTAR_SERVICE, KEYTAR_OAUTH_CACHE_ACCOUNT);
    if (cached) return cached;
  } catch {
    // keytar unavailable
  }

  try {
    return fs.readFileSync(OAUTH_CACHE_FILE, 'utf8');
  } catch {
    return null;
  }
}
