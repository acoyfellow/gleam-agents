import { mkdtempSync, readFileSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { startLocal } from './local-server';

vi.mock('cloudflare:workers', () => ({ DurableObject: class { constructor(public ctx: unknown, public env: unknown) {} } }));

const { Directory, Grant } = await import('../src/objects');

const store = () => {
  const data = new Map<string, unknown>();
  const tables = new Map<string, Record<string, unknown>[]>();
  return { put: async (k: string, v: unknown) => void data.set(k, v), get: async (k: string) => data.get(k), deleteAll: async () => data.clear(), setAlarm: async () => undefined, sql: sqlOf(tables) };
};

const sqlOf = (tables: Map<string, Record<string, unknown>[]>) => ({
  exec: (query: string, ...args: unknown[]) => {
    const q = query.trim();
    let rows: Record<string, unknown>[] = [];
    const create = q.match(/^CREATE TABLE IF NOT EXISTS (\w+)/u);
    if (create) tables.set(create[1] as string, tables.get(create[1] as string) ?? []);
    const insert = q.match(/^INSERT (?:OR REPLACE )?INTO (\w+) \(([^)]+)\) VALUES \(([^)]+)\)/u);
    if (insert) {
      const cols = (insert[2] as string).split(',').map((c) => c.trim());
      const vals = (insert[3] as string).split(',').map((v) => v.trim());
      let i = 0;
      const row: Record<string, unknown> = {};
      cols.forEach((c, n) => (row[c] = vals[n] === '?' ? args[i++] : null));
      const t = tables.get(insert[1] as string) as Record<string, unknown>[];
      const at = t.findIndex((r) => r[cols[0] as string] === row[cols[0] as string]);
      if (at >= 0) t[at] = row;
      else t.push(row);
    }
    const select = q.match(/^SELECT (.+?) FROM (\w+)(?: WHERE (.+?))?(?: ORDER BY (\w+) DESC)?(?: LIMIT \d+)?$/u);
    if (select) {
      let i = 0;
      const conds = (select[3] ?? '').split(' AND ').filter(Boolean).map((w) => {
        const m = w.match(/(\w+) (=|>) \?/u) as RegExpMatchArray;
        return { col: m[1] as string, op: m[2], val: args[i++] };
      });
      rows = (tables.get(select[2] as string) ?? []).filter((r) => conds.every((c) => (c.op === '=' ? r[c.col] === c.val : (r[c.col] as number) > (c.val as number))));
    }
    const update = q.match(/^UPDATE (\w+) SET (\w+) = \? WHERE (\w+) = \?/u);
    if (update) for (const r of tables.get(update[1] as string) ?? []) if (r[update[3] as string] === args[1]) r[update[2] as string] = args[0];
    const del = q.match(/^DELETE FROM (\w+) WHERE (\w+) = \?/u);
    if (del) tables.set(del[1] as string, (tables.get(del[1] as string) ?? []).filter((r) => r[del[2] as string] !== args[0]));
    return { toArray: () => rows };
  },
});

const ns = <T>(make: (ctx: { storage: ReturnType<typeof store> }) => T) => {
  const m = new Map<string, T>();
  return { getByName: (n: string) => (m.has(n) ? (m.get(n) as T) : (m.set(n, make({ storage: store() })), m.get(n) as T)) };
};

const makeEnv = () =>
  ({
    DIRECTORY: ns((ctx) => new Directory(ctx as never, {})),
    GRANTS: ns((ctx) => new Grant(ctx as never, {})),
    OAUTH_CLIENT_ID: 'c',
    OAUTH_CLIENT_SECRET: 's',
    SESSION_SECRET: 'y'.repeat(40),
    TOKEN_ENC_KEY: 'cd'.repeat(32),
  }) as never;

const cookiesOf = (r: Response) => r.headers.getSetCookie().map((c) => c.split(';')[0] as string).filter((c) => !c.endsWith('=')).join('; ');

describe('the Pi extension against a local instance', () => {
  it('logs in with a code, publishes a recomputed score, and lists it', async () => {
    const port = 18000 + Math.floor(Math.random() * 1000);
    const local = await startLocal(makeEnv, port);
    const dir = mkdtempSync(join(tmpdir(), 'ga-ext-'));
    process.env.GLEAM_AGENTS_URL = local.origin;
    process.env.GLEAM_AGENTS_TOKEN_FILE = join(dir, 'token');
    process.env.GLEAM_AGENTS_REPO = new URL('../../', import.meta.url).pathname;
    const ext = await import('../../pi/index.ts');

    const browser = async (approve: string) => {
      const start = await fetch(`${local.origin}/oauth/login`, { redirect: 'manual' });
      const state = new URL(start.headers.get('location') as string).searchParams.get('state');
      const back = await fetch(`${local.origin}/oauth/callback?code=x&state=${state}`, { redirect: 'manual', headers: { cookie: cookiesOf(start) } });
      const jar = cookiesOf(back);
      const page = await (await fetch(approve.replace('https://gleam-agents.coey.dev', local.origin), { headers: { cookie: jar } })).text();
      expect(page).toContain('Let a CLI act as you?');
      const ok = await fetch(approve.replace('https://gleam-agents.coey.dev', local.origin), { method: 'POST', headers: { cookie: jar, origin: 'https://gleam-agents.coey.dev' } });
      expect(ok.status).toBe(200);
    };

    let shown = '';
    const who = await ext.login((t: string) => {
      shown = t;
      const approve = t.match(/Open (\S+)/u)?.[1] as string;
      void browser(approve);
    }, 'test');
    expect(shown).toMatch(/code [0-9A-F]{6}/u);
    expect(who).toContain('via cli-token');
    expect((statSync(join(dir, 'token')).mode & 0o777).toString(8)).toBe('600');
    expect(readFileSync(join(dir, 'token'), 'utf8')).toMatch(/^ga_/u);

    const published = await ext.publish('proof/smoke-3', 'extension test', '# notes');
    expect(published.url).toContain('/reports/');
    const list = (await (await fetch(`${local.origin}/api/reports`)).json()) as { title: string; summary: { passed: number } }[];
    expect(list[0]).toMatchObject({ title: 'extension test', summary: { passed: 1 } });
    local.close();
  }, 30_000);
});
