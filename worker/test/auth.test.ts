import { describe, expect, it } from 'vitest';
import { safeReturn } from '../src/auth/return';
import { SCOPES } from '../src/auth/oauth';
import { cookieJar, parseFlow, parseSession } from '../src/auth/session';

describe('scopes', () => {
  it('asks only for the least scopes the funnel allows', () => {
    expect([...SCOPES].sort()).toEqual(['account-settings.read', 'aig.read', 'aig.run', 'ai.read', 'offline_access', 'user-details.read'].sort());
    expect(SCOPES).not.toContain('openid');
    expect(SCOPES).not.toContain('ai.write');
  });
});

describe('cookies by environment', () => {
  it('uses __Host- and Secure in prod even on http', () => {
    expect(cookieJar('http://gleam-agents.coey.dev/', undefined)).toEqual({ session: '__Host-ga_session', flow: '__Host-ga_oauth', secure: true });
  });
  it('relaxes only for ENV=dev on localhost', () => {
    expect(cookieJar('http://localhost:8833/', 'dev').secure).toBe(false);
    expect(cookieJar('http://example.com/', 'dev').secure).toBe(true);
  });
});

describe('parsers', () => {
  it('refuses expired sessions and flows', () => {
    const now = 1_000;
    expect(parseSession(JSON.stringify({ owner: 'cf:a', id: 'x', expires: 999 }), now)).toBeNull();
    expect(parseSession(JSON.stringify({ owner: 'cf:a', id: 'x', expires: 2_000 }), now)).not.toBeNull();
    expect(parseFlow(JSON.stringify({ state: 's', verifier: 'v', back: '/', expires: 2_000 }), now)).not.toBeNull();
    expect(parseFlow(JSON.stringify({ state: 's', verifier: 'v', expires: 2_000 }), now)).toBeNull();
  });
});

describe('safe return', () => {
  it('keeps same-site doc and cli paths only', () => {
    expect(safeReturn('/docs/scope')).toBe('/docs/scope');
    expect(safeReturn('/cli/approve?id=ab&code=CD')).toBe('/cli/approve?id=ab&code=CD');
    expect(safeReturn('https://evil.example')).toBe('/');
    expect(safeReturn('//evil.example')).toBe('/');
  });
});
