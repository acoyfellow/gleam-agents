import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeCloudflare } from './fake-cloudflare';

vi.mock('cloudflare:workers', () => ({
  DurableObject: class {
    ctx: unknown;
    env: unknown;
    constructor(ctx: unknown, env: unknown) {
      this.ctx = ctx;
      this.env = env;
    }
  },
}));

const { Directory, Grant } = await import('../src/objects');
const { handle } = await import('../src/index');

type Row = Record<string, unknown>;

const memorySql = () => {
  const tables = new Map<string, Row[]>();
  const exec = (query: string, ...args: unknown[]) => {
    const q = query.trim();
    let rows: Row[] = [];
    const create = q.match(/^CREATE TABLE IF NOT EXISTS (\w+)/u);
    if (create) tables.set(create[1] as string, tables.get(create[1] as string) ?? []);
    const insert = q.match(/^INSERT (?:OR REPLACE )?INTO (\w+) \(([^)]+)\) VALUES \(([^)]+)\)/u);
    if (insert) {
      const table = tables.get(insert[1] as string) as Row[];
      const cols = (insert[2] as string).split(',').map((c) => c.trim());
      const vals = (insert[3] as string).split(',').map((v) => v.trim());
      let i = 0;
      const row: Row = {};
      cols.forEach((c, n) => {
        row[c] = vals[n] === '?' ? args[i++] : vals[n] === 'NULL' ? null : vals[n];
      });
      const key = cols[0] as string;
      const existing = table.findIndex((r) => r[key] === row[key]);
      if (existing >= 0) table[existing] = row;
      else table.push(row);
    }
    const select = q.match(/^SELECT (.+?) FROM (\w+)(?: WHERE (.+?))?(?: ORDER BY (\w+) DESC)?(?: LIMIT \d+)?$/u);
    if (select) {
      const table = tables.get(select[2] as string) as Row[];
      const where = (select[3] ?? '').split(' AND ').filter(Boolean);
      let i = 0;
      const conds = where.map((w) => {
        const m = w.match(/(\w+) (=|>) \?/u) as RegExpMatchArray;
        return { col: m[1] as string, op: m[2], val: args[i++] };
      });
      rows = table.filter((r) => conds.every((c) => (c.op === '=' ? r[c.col] === c.val : (r[c.col] as number) > (c.val as number))));
      if (select[4]) rows = [...rows].sort((a, b) => (b[select[4] as string] as number) - (a[select[4] as string] as number));
    }
    const update = q.match(/^UPDATE (\w+) SET (\w+) = \? WHERE (\w+) = \?/u);
    if (update) for (const r of tables.get(update[1] as string) ?? []) if (r[update[3] as string] === args[1]) r[update[2] as string] = args[0];
    const del = q.match(/^DELETE FROM (\w+) WHERE (\w+) = \?/u);
    if (del) tables.set(del[1] as string, (tables.get(del[1] as string) ?? []).filter((r) => r[del[2] as string] !== args[0]));
    return { toArray: () => rows };
  };
  return { exec };
};

const kv = () => {
  const data = new Map<string, unknown>();
  return {
    put: async (k: string, v: unknown) => void data.set(k, structuredClone(v)),
    get: async (k: string) => structuredClone(data.get(k)),
    deleteAll: async () => void data.clear(),
    setAlarm: async () => undefined,
    sql: memorySql(),
  };
};

const namespace = <T>(make: (ctx: { storage: ReturnType<typeof kv> }) => T) => {
  const objects = new Map<string, T>();
  return {
    getByName: (name: string) => {
      if (!objects.has(name)) objects.set(name, make({ storage: kv() }));
      return objects.get(name) as T;
    },
  };
};

const ORIGIN = 'https://gleam-agents.coey.dev';

const makeEnv = () => ({
  DIRECTORY: namespace((ctx) => new Directory(ctx as never, {})),
  GRANTS: namespace((ctx) => new Grant(ctx as never, {})),
  OAUTH_CLIENT_ID: 'client-1',
  OAUTH_CLIENT_SECRET: 'secret-1',
  SESSION_SECRET: 'x'.repeat(40),
  TOKEN_ENC_KEY: 'ab'.repeat(32),
}) as never;

const cookiesOf = (response: Response) =>
  response.headers
    .getSetCookie()
    .map((c) => c.split(';')[0] as string)
    .filter((c) => !c.endsWith('='))
    .join('; ');

const signIn = async (env: never, send: typeof fetch, accountsCount = 1) => {
  const start = await handle(new Request(`${ORIGIN}/oauth/login`), env, send);
  expect(start.status).toBe(302);
  const authorize = new URL(start.headers.get('location') as string);
  expect(authorize.origin).toBe('https://dash.cloudflare.com');
  const state = authorize.searchParams.get('state') as string;
  const back = await handle(new Request(`${ORIGIN}/oauth/callback?code=c1&state=${state}`, { headers: { cookie: cookiesOf(start) } }), env, send);
  expect(back.status).toBe(302);
  const jar = cookiesOf(back);
  if (accountsCount > 1) expect(back.headers.get('location')).toContain('/oauth/account');
  return jar;
};

describe('the site without a session', () => {
  let env: never;
  beforeEach(() => {
    env = makeEnv();
  });

  it('serves landing, docs, llms.txt and reports to strangers', async () => {
    const send = fakeCloudflare({ accounts: [{ id: 'acct-1', name: 'One' }] }).send;
    for (const path of ['/', '/docs', '/docs/scope', '/docs/scope.md', '/llms.txt', '/reports', '/api/reports', '/robots.txt']) {
      const r = await handle(new Request(`${ORIGIN}${path}`), env, send);
      expect(r.status, path).toBe(200);
    }
    const landing = await (await handle(new Request(`${ORIGIN}/`), env, send)).text();
    expect(landing).toContain('Sign in with Cloudflare');
    expect(landing).toContain('docs and published reports only');
  });

  it('refuses to publish without sign-in', async () => {
    const send = fakeCloudflare({ accounts: [] }).send;
    const r = await handle(new Request(`${ORIGIN}/api/reports`, { method: 'POST', body: '{}' }), env, send);
    expect(r.status).toBe(401);
    const me = await handle(new Request(`${ORIGIN}/oauth/me`), env, send);
    expect(me.status).toBe(401);
  });

  it('sends the least scopes and the right redirect to Cloudflare', async () => {
    const r = await handle(new Request(`${ORIGIN}/oauth/login`), env, fakeCloudflare({ accounts: [] }).send);
    const to = new URL(r.headers.get('location') as string);
    expect(to.searchParams.get('scope')).toBe('offline_access user-details.read account-settings.read ai.read aig.read aig.run');
    expect(to.searchParams.get('redirect_uri')).toBe(`${ORIGIN}/oauth/callback`);
    expect(to.searchParams.get('code_challenge_method')).toBe('S256');
  });

  it('refuses a callback whose state does not match', async () => {
    const send = fakeCloudflare({ accounts: [{ id: 'a', name: 'A' }] }).send;
    const start = await handle(new Request(`${ORIGIN}/oauth/login`), env, send);
    const r = await handle(new Request(`${ORIGIN}/oauth/callback?code=c1&state=wrong`, { headers: { cookie: cookiesOf(start) } }), env, send);
    expect(r.status).toBe(400);
  });
});

describe('a signed-in person', () => {
  it('with one account is signed in at once and can publish', async () => {
    const env = makeEnv();
    const fake = fakeCloudflare({ accounts: [{ id: 'acct-1', name: 'One' }] });
    const jar = await signIn(env, fake.send);
    const me = await (await handle(new Request(`${ORIGIN}/oauth/me`, { headers: { cookie: jar } }), env, fake.send)).json();
    expect(me).toMatchObject({ signedIn: true, account: 'One', via: 'session', email: 'person@example.com' });
    const post = await handle(new Request(`${ORIGIN}/api/reports`, { method: 'POST', headers: { cookie: jar }, body: JSON.stringify({ title: 't', summary: { passed: 1, seats: 1 }, markdown: 'm' }) }), env, fake.send);
    expect(post.status).toBe(201);
  });

  it('with two accounts must pick one before anything works', async () => {
    const env = makeEnv();
    const fake = fakeCloudflare({ accounts: [{ id: 'acct-1', name: 'One' }, { id: 'acct-2', name: 'Two' }] });
    const jar = await signIn(env, fake.send, 2);
    expect((await handle(new Request(`${ORIGIN}/oauth/me`, { headers: { cookie: jar } }), env, fake.send)).status).toBe(401);
    const form = new FormData();
    form.set('account', 'acct-2');
    const cross = await handle(new Request(`${ORIGIN}/oauth/account`, { method: 'POST', headers: { cookie: jar, origin: 'https://evil.example' }, body: form }), env, fake.send);
    expect(cross.status).toBe(403);
    const pick = await handle(new Request(`${ORIGIN}/oauth/account`, { method: 'POST', headers: { cookie: jar, origin: ORIGIN }, body: form }), env, fake.send);
    expect(pick.status).toBe(303);
    const me = await (await handle(new Request(`${ORIGIN}/oauth/me`, { headers: { cookie: jar } }), env, fake.send)).json();
    expect(me).toMatchObject({ signedIn: true, account: 'Two' });
  });

  it('approves a CLI login, and the CLI token publishes; sign out revokes it', async () => {
    const env = makeEnv();
    const fake = fakeCloudflare({ accounts: [{ id: 'acct-1', name: 'One' }] });
    const jar = await signIn(env, fake.send);
    const start = (await (await handle(new Request(`${ORIGIN}/cli/start`, { method: 'POST' }), env, fake.send)).json()) as { id: string; code: string; approve: string };
    const early = await handle(new Request(`${ORIGIN}/cli/finish`, { method: 'POST', body: JSON.stringify({ id: start.id }) }), env, fake.send);
    expect(early.status).toBe(202);
    const wrong = await handle(new Request(`${ORIGIN}/cli/approve?id=${start.id}&code=NOPE`, { method: 'POST', headers: { cookie: jar, origin: ORIGIN } }), env, fake.send);
    expect(wrong.status).toBe(400);
    const ok = await handle(new Request(start.approve, { method: 'POST', headers: { cookie: jar, origin: ORIGIN } }), env, fake.send);
    expect(ok.status).toBe(200);
    const done = (await (await handle(new Request(`${ORIGIN}/cli/finish`, { method: 'POST', body: JSON.stringify({ id: start.id }) }), env, fake.send)).json()) as { token: string };
    expect(done.token).toMatch(/^ga_[0-9a-f]{64}$/u);
    const again = await handle(new Request(`${ORIGIN}/cli/finish`, { method: 'POST', body: JSON.stringify({ id: start.id }) }), env, fake.send);
    expect(again.status).toBe(202);
    const bearer = { authorization: `Bearer ${done.token}` };
    const me = await (await handle(new Request(`${ORIGIN}/oauth/me`, { headers: bearer }), env, fake.send)).json();
    expect(me).toMatchObject({ signedIn: true, via: 'cli-token' });
    const post = await handle(new Request(`${ORIGIN}/api/reports`, { method: 'POST', headers: bearer, body: JSON.stringify({ title: 'via cli', summary: { passed: 2, seats: 3 }, markdown: '# m' }) }), env, fake.send);
    expect(post.status).toBe(201);
    const list = (await (await handle(new Request(`${ORIGIN}/api/reports`), env, fake.send)).json()) as { title: string }[];
    expect(list.map((r) => r.title)).toContain('via cli');
    const out = await handle(new Request(`${ORIGIN}/oauth/logout`, { method: 'POST', headers: { cookie: jar, origin: ORIGIN } }), env, fake.send);
    expect(out.status).toBe(303);
    expect(fake.revoked.length).toBe(1);
    expect((await handle(new Request(`${ORIGIN}/oauth/me`, { headers: bearer }), env, fake.send)).status).toBe(401);
  });

  it('never shows the token in /oauth/me or stores it in plain text', async () => {
    const env = makeEnv();
    const fake = fakeCloudflare({ accounts: [{ id: 'acct-1', name: 'One' }] });
    const jar = await signIn(env, fake.send);
    const body = await (await handle(new Request(`${ORIGIN}/oauth/me`, { headers: { cookie: jar } }), env, fake.send)).text();
    expect(body).not.toContain('at-1');
    const grant = (await (env as { GRANTS: { getByName: (n: string) => { get: () => Promise<Record<string, unknown>> } } }).GRANTS.getByName('cf:user-1').get()) as Record<string, unknown>;
    expect(JSON.stringify(grant)).not.toContain('at-1');
    expect(JSON.stringify(grant)).not.toContain('rt-1');
  });
});

describe('report notes', () => {
  it('render markdown tables but never raw HTML or script links', async () => {
    const env = makeEnv();
    const fake = fakeCloudflare({ accounts: [{ id: 'acct-1', name: 'One' }] });
    const jar = await signIn(env, fake.send);
    const markdown = '| a | b |\n|---|---|\n| 1 | 2 |\n\n<script>alert(1)</script>\n\n[x](javascript:alert(1)) <img src=x onerror=alert(1)>';
    const post = await handle(new Request(`${ORIGIN}/api/reports`, { method: 'POST', headers: { cookie: jar }, body: JSON.stringify({ title: 't', summary: { per_seat: [{ seat: '<b>s</b>', graded_pass: true }] }, markdown }) }), env, fake.send);
    const { id } = (await post.json()) as { id: string };
    const page = await (await handle(new Request(`${ORIGIN}/reports/${id}`), env, fake.send)).text();
    expect(page).toContain('<table>');
    expect(page).not.toContain('<script>alert');
    expect(page).not.toContain('<img');
    expect(page).not.toContain('href="javascript:');
    expect(page).not.toContain('<b>s</b>');
  });
});
