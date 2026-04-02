import { styleText } from 'node:util';
import Table from 'cli-table3';

export const isTTY = process.stdout.isTTY ?? false;

// ─── JSON output ────────────────────────────────────────────────────────────

function filterFields<T>(item: T, fields: string): T {
  const fieldList = fields.split(',').map(f => f.trim());
  const result: Record<string, unknown> = {};
  for (const f of fieldList) {
    result[f] = (item as Record<string, unknown>)[f];
  }
  return result as T;
}

export function outputJson<T>(data: T, fields?: string): void {
  const out = fields ? (Array.isArray(data)
    ? (data as T[]).map(item => filterFields(item, fields))
    : filterFields(data, fields)) : data;
  process.stdout.write(JSON.stringify(out, null, 2) + '\n');
}

// ─── Table output (lists) ────────────────────────────────────────────────────

export function outputTable(headers: string[], rows: string[][]): void {
  if (!isTTY) {
    // Plain tab-separated for pipes/agents
    for (const row of rows) {
      process.stdout.write(row.join('\t') + '\n');
    }
    return;
  }

  const table = new Table({
    head: headers.map(h => styleText('bold', h)),
    style: { compact: true, 'padding-left': 1, 'padding-right': 1 },
    chars: {
      top: '', 'top-mid': '', 'top-left': '', 'top-right': '',
      bottom: '', 'bottom-mid': '', 'bottom-left': '', 'bottom-right': '',
      left: '', 'left-mid': '', mid: '', 'mid-mid': '',
      right: '', 'right-mid': '', middle: '  ',
    },
  });

  for (const row of rows) {
    table.push(row);
  }

  process.stdout.write(table.toString() + '\n');
}

// ─── Detail output (single item) ────────────────────────────────────────────

export function outputDetail(fields: Array<[string, string | undefined | null]>): void {
  const maxKey = Math.max(...fields.map(([k]) => k.length));

  for (const [key, value] of fields) {
    if (value === undefined || value === null || value === '') continue;
    const label = isTTY ? styleText('bold', key.padEnd(maxKey)) : key.padEnd(maxKey);
    // Indent multi-line values
    const lines = String(value).split('\n');
    if (lines.length === 1) {
      process.stdout.write(`${label}  ${lines[0]}\n`);
    } else {
      process.stdout.write(`${label}\n`);
      for (const line of lines) {
        process.stdout.write(`  ${line}\n`);
      }
    }
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function relativeDate(date: Date | string | undefined | null): string {
  if (!date) return '';
  const d = typeof date === 'string' ? new Date(date) : date;
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return d.toISOString().slice(0, 10);
}

export function truncate(str: string | undefined | null, max: number): string {
  if (!str) return '';
  return str.length > max ? str.slice(0, max - 1) + '…' : str;
}

export function colorState(state: string | undefined | null): string {
  if (!state) return '';
  if (!isTTY) return state;
  const s = state.toLowerCase();
  if (s === 'active' || s === 'open') return styleText('green', state);
  if (s === 'closed' || s === 'resolved' || s === 'done') return styleText('red', state);
  if (s === 'new') return styleText('blue', state);
  return state;
}

export function colorPrState(state: string | undefined | null): string {
  if (!state) return '';
  if (!isTTY) return state;
  const s = state.toLowerCase();
  if (s === 'active') return styleText('green', state);
  if (s === 'completed') return styleText('magenta', state);
  if (s === 'abandoned') return styleText('red', state);
  return state;
}
