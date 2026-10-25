import { DurableObject } from 'cloudflare:workers';

export const DIRECTORY_NAME = 'all';
export const GRANT_IDLE_MS = 30 * 24 * 60 * 60 * 1000;

export type SealedGrant = {
  readonly owner: string;
  readonly email: string | null;
  readonly accountId: string;
  readonly accountName: string;
  readonly sealedAccess: string;
  readonly sealedRefresh: string | null;
  readonly expiresAt: number;
  readonly scope: string;
};

export class Grant extends DurableObject {
  async put(grant: SealedGrant): Promise<void> {
    await this.ctx.storage.put('grant', grant);
    await this.ctx.storage.setAlarm(Date.now() + GRANT_IDLE_MS);
  }

  async get(): Promise<SealedGrant | null> {
    const grant = (await this.ctx.storage.get<SealedGrant>('grant')) ?? null;
    if (grant !== null) await this.ctx.storage.setAlarm(Date.now() + GRANT_IDLE_MS);
    return grant;
  }

  async drop(): Promise<void> {
    await this.ctx.storage.deleteAll();
  }

  override async alarm(): Promise<void> {
    await this.ctx.storage.deleteAll();
  }
}

export type Report = {
  readonly id: string;
  readonly owner: string;
  readonly title: string;
  readonly createdAt: number;
  readonly summary: Record<string, unknown>;
  readonly markdown: string;
};

export type PendingLogin = { readonly code: string; readonly expires: number; readonly owner: string | null };

export class Directory extends DurableObject {
  constructor(ctx: DurableObjectState, env: unknown) {
    super(ctx, env as never);
    const sql = ctx.storage.sql;
    sql.exec('CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, owner TEXT NOT NULL, expires_at INTEGER NOT NULL)');
    sql.exec('CREATE TABLE IF NOT EXISTS cli_tokens (hash TEXT PRIMARY KEY, owner TEXT NOT NULL, label TEXT NOT NULL, created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL)');
    sql.exec('CREATE TABLE IF NOT EXISTS cli_logins (id TEXT PRIMARY KEY, code TEXT NOT NULL, owner TEXT, expires_at INTEGER NOT NULL)');
    sql.exec('CREATE TABLE IF NOT EXISTS reports (id TEXT PRIMARY KEY, owner TEXT NOT NULL, title TEXT NOT NULL, created_at INTEGER NOT NULL, summary TEXT NOT NULL, markdown TEXT NOT NULL)');
  }

  openSession(id: string, owner: string, expiresAt: number): void {
    this.ctx.storage.sql.exec('INSERT OR REPLACE INTO sessions (id, owner, expires_at) VALUES (?, ?, ?)', id, owner, expiresAt);
  }

  sessionOwner(id: string): string | null {
    const row = this.ctx.storage.sql.exec<{ owner: string }>('SELECT owner FROM sessions WHERE id = ? AND expires_at > ?', id, Date.now()).toArray()[0];
    return row?.owner ?? null;
  }

  closeSession(id: string): void {
    this.ctx.storage.sql.exec('DELETE FROM sessions WHERE id = ?', id);
  }

  closeOwner(owner: string): void {
    this.ctx.storage.sql.exec('DELETE FROM sessions WHERE owner = ?', owner);
    this.ctx.storage.sql.exec('DELETE FROM cli_tokens WHERE owner = ?', owner);
  }

  startCliLogin(id: string, code: string, expiresAt: number): void {
    this.ctx.storage.sql.exec('INSERT INTO cli_logins (id, code, owner, expires_at) VALUES (?, ?, NULL, ?)', id, code, expiresAt);
  }

  cliLogin(id: string): PendingLogin | null {
    const row = this.ctx.storage.sql.exec<{ code: string; owner: string | null; expires_at: number }>('SELECT code, owner, expires_at FROM cli_logins WHERE id = ?', id).toArray()[0];
    if (row === undefined || row.expires_at <= Date.now()) return null;
    return { code: row.code, owner: row.owner, expires: row.expires_at };
  }

  approveCliLogin(id: string, code: string, owner: string): boolean {
    const pending = this.cliLogin(id);
    if (pending === null || pending.code !== code || pending.owner !== null) return false;
    this.ctx.storage.sql.exec('UPDATE cli_logins SET owner = ? WHERE id = ?', owner, id);
    return true;
  }

  finishCliLogin(id: string): string | null {
    const pending = this.cliLogin(id);
    if (pending === null || pending.owner === null) return null;
    this.ctx.storage.sql.exec('DELETE FROM cli_logins WHERE id = ?', id);
    return pending.owner;
  }

  saveCliToken(hash: string, owner: string, label: string, expiresAt: number): void {
    this.ctx.storage.sql.exec('INSERT INTO cli_tokens (hash, owner, label, created_at, expires_at) VALUES (?, ?, ?, ?, ?)', hash, owner, label, Date.now(), expiresAt);
  }

  cliTokenOwner(hash: string): string | null {
    const row = this.ctx.storage.sql.exec<{ owner: string }>('SELECT owner FROM cli_tokens WHERE hash = ? AND expires_at > ?', hash, Date.now()).toArray()[0];
    return row?.owner ?? null;
  }

  dropCliToken(hash: string): void {
    this.ctx.storage.sql.exec('DELETE FROM cli_tokens WHERE hash = ?', hash);
  }

  saveReport(report: Report): void {
    this.ctx.storage.sql.exec(
      'INSERT OR REPLACE INTO reports (id, owner, title, created_at, summary, markdown) VALUES (?, ?, ?, ?, ?, ?)',
      report.id, report.owner, report.title, report.createdAt, JSON.stringify(report.summary), report.markdown,
    );
  }

  listReports(): Omit<Report, 'markdown' | 'owner'>[] {
    return this.ctx.storage.sql
      .exec<{ id: string; title: string; created_at: number; summary: string }>('SELECT id, title, created_at, summary FROM reports ORDER BY created_at DESC LIMIT 100')
      .toArray()
      .map((row) => ({ id: row.id, title: row.title, createdAt: row.created_at, summary: JSON.parse(row.summary) as Record<string, unknown> }));
  }

  report(id: string): Omit<Report, 'owner'> | null {
    const row = this.ctx.storage.sql.exec<{ id: string; title: string; created_at: number; summary: string; markdown: string }>('SELECT id, title, created_at, summary, markdown FROM reports WHERE id = ?', id).toArray()[0];
    return row === undefined ? null : { id: row.id, title: row.title, createdAt: row.created_at, summary: JSON.parse(row.summary) as Record<string, unknown>, markdown: row.markdown };
  }
}
