import { Command } from 'commander';
import { spawnSync } from 'child_process';
import { writeFileSync, renameSync, unlinkSync } from 'fs';
import * as path from 'path';
import * as os from 'os';
import { version as currentVersion } from '../../package.json';

const REPO = 'yutamago/ado-cli';
const PACKAGE_NAME = 'ado-cli';

interface GithubRelease {
  tag_name: string;
}

async function fetchLatestVersion(): Promise<string | null> {
  try {
    const res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
      signal: AbortSignal.timeout(5000),
      headers: {
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as GithubRelease;
    return data.tag_name?.replace(/^v/, '') ?? null;
  } catch {
    return null;
  }
}

function isNewer(latest: string, current: string): boolean {
  const parse = (v: string) => v.split('.').map(Number);
  const [lMaj, lMin, lPatch] = parse(latest);
  const [cMaj, cMin, cPatch] = parse(current);
  if (lMaj !== cMaj) return lMaj > cMaj;
  if (lMin !== cMin) return lMin > cMin;
  return lPatch > cPatch;
}

/** Returns true when running as a compiled standalone binary (bun --compile). */
function isStandaloneBinary(): boolean {
  const base = path.basename(process.execPath).replace(/\.exe$/i, '').toLowerCase();
  return base !== 'node' && !base.startsWith('node') && base !== 'bun';
}

function getPlatformBinaryName(): string | null {
  const platform = os.platform();
  const arch = os.arch();

  const osMap: Record<string, string> = { linux: 'linux', darwin: 'darwin', win32: 'windows' };
  const archMap: Record<string, string> = { x64: 'x64', arm64: 'arm64' };

  const osName = osMap[platform];
  const archName = archMap[arch];
  if (!osName || !archName) return null;

  return `ado-${osName}-${archName}${platform === 'win32' ? '.exe' : ''}`;
}

async function installBinaryUpdate(latest: string): Promise<void> {
  const binaryName = getPlatformBinaryName();
  if (!binaryName) {
    process.stderr.write(`ado: unsupported platform (${os.platform()}/${os.arch()}).\n`);
    process.exit(1);
  }

  const url = `https://github.com/${REPO}/releases/download/v${latest}/${binaryName}`;
  process.stdout.write(`Downloading ${binaryName} from GitHub releases...\n`);

  let res: Response;
  try {
    res = await fetch(url, { signal: AbortSignal.timeout(120_000) });
  } catch (err) {
    process.stderr.write(`ado: download failed: ${(err as Error).message}\n`);
    process.exit(1);
  }

  if (!res.ok) {
    process.stderr.write(`ado: download failed (HTTP ${res.status} for ${url}).\n`);
    process.exit(1);
  }

  const data = Buffer.from(await res.arrayBuffer());
  const currentBin = process.execPath;
  const tmpPath = `${currentBin}.tmp`;

  try {
    writeFileSync(tmpPath, data, { mode: 0o755 });
    renameSync(tmpPath, currentBin);
  } catch (err) {
    try { unlinkSync(tmpPath); } catch { /* ignore */ }
    const nodeErr = err as NodeJS.ErrnoException;
    process.stderr.write(`ado: failed to replace binary: ${nodeErr.message}\n`);
    if (nodeErr.code === 'EACCES') {
      process.stderr.write(`Try: sudo ado update install\n`);
    } else if (nodeErr.code === 'EBUSY') {
      // Windows: can't replace a running .exe
      process.stderr.write(
        `The binary is locked by the OS. Re-run the install script to update:\n` +
        `  irm https://raw.githubusercontent.com/${REPO}/main/install.ps1 | iex\n`,
      );
    }
    process.exit(1);
  }

  process.stdout.write(`\nSuccessfully updated to ado ${latest}\n`);
}

async function installNpmUpdate(latest: string): Promise<void> {
  const managers: Array<{ cmd: string; args: string[] }> = [
    { cmd: 'npm', args: ['install', '-g', PACKAGE_NAME] },
    { cmd: 'bun', args: ['install', '-g', PACKAGE_NAME] },
  ];

  for (const { cmd, args } of managers) {
    const result = spawnSync(cmd, args, { stdio: 'inherit', shell: false });
    if (result.status === 0) {
      process.stdout.write(`\nSuccessfully updated to ado ${latest}\n`);
      return;
    }
    if (result.error?.message.includes('ENOENT')) {
      continue; // package manager not found, try the next
    }
    process.stderr.write(`ado: update failed (exit ${result.status ?? 'unknown'}).\n`);
    process.exit(result.status ?? 1);
  }

  process.stderr.write(
    `ado: Could not find npm or bun. Install one and run: npm install -g ${PACKAGE_NAME}\n`,
  );
  process.exit(1);
}

async function updateStatusHandler(): Promise<void> {
  process.stdout.write(`ado version ${currentVersion}\n`);
  process.stdout.write('Checking for updates...\n');

  const latest = await fetchLatestVersion();
  if (latest === null) {
    process.stderr.write('Could not check for updates (GitHub API unreachable).\n');
    return;
  }

  if (isNewer(latest, currentVersion)) {
    process.stdout.write(`\nA new version is available: ${latest}\n`);
    process.stdout.write('To install it, run: ado update install\n');
  } else {
    process.stdout.write('You are on the latest version.\n');
  }
}

async function updateInstallHandler(): Promise<void> {
  process.stdout.write('Checking for updates...\n');

  const latest = await fetchLatestVersion();
  if (latest === null) {
    process.stderr.write('ado: Could not reach GitHub API. Check your internet connection.\n');
    process.exit(1);
  }

  if (!isNewer(latest, currentVersion)) {
    process.stdout.write(`Already on the latest version (${currentVersion}).\n`);
    return;
  }

  process.stdout.write(`Updating ado from ${currentVersion} → ${latest}...\n`);

  if (isStandaloneBinary()) {
    await installBinaryUpdate(latest);
  } else {
    await installNpmUpdate(latest);
  }
}

export function registerUpdateCommand(program: Command): void {
  const updateCmd = program
    .command('update')
    .description('Show current version and check for updates')
    .action(updateStatusHandler);

  updateCmd
    .command('install')
    .description('Install the latest version of ado')
    .action(updateInstallHandler);
}
