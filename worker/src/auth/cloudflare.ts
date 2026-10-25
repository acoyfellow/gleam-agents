import { open, randomHex, seal, sha256 } from '../crypto';
import { DIRECTORY_NAME, type Directory, type Grant, type SealedGrant } from '../objects';
import { page } from '../pages/layout';
import { safeReturn } from './return';
import { accountsOf, authorizeUrl, exchangeCode, OAuthFailed, type OAuthClient, randomToken, revoke, userInfo } from './oauth';
import { clearCookie, cookie, cookieJar, type Flow, FLOW_TTL_MS, parseFlow, parseSession, readCookie, SESSION_TTL_MS, sessionValue, sign, unsign } from './session';

export type AuthEnv = {
  readonly DIRECTORY: DurableObjectNamespace<Directory>;
  readonly GRANTS: DurableObjectNamespace<Grant>;
  readonly OAUTH_CLIENT_ID?: string;
  readonly OAUTH_CLIENT_SECRET?: string;
  readonly SESSION_SECRET?: string;
  readonly TOKEN_ENC_KEY?: string;
  readonly ENV?: string;
};

export const OWNER_PREFIX = 'cf:';
const CLI_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const CLI_LOGIN_TTL_MS = 10 * 60 * 1000;

const html = (body: string, status = 200, headers: Record<string, string> = {}) =>
  new Response(body, { status, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', ...headers } });

const redirect = (location: string, cookies: string[] = [], status: 302 | 303 = 302) => {
  const headers = new Headers({ location, 'cache-control': 'no-store' });
  for (const each of cookies) headers.append('set-cookie', each);
  return new Response(null, { status, headers });
};

const sameOrigin = (request: Request) => request.headers.get('origin') === new URL(request.url).origin;

export type Signed = { readonly owner: string; readonly sessionId: string | null };

export const authFor = (env: AuthEnv, send: typeof fetch = fetch) => {
  const directory = () => env.DIRECTORY.getByName(DIRECTORY_NAME);
  const grants = (owner: string) => env.GRANTS.getByName(owner);
  const secret = env.SESSION_SECRET ?? '';
  const encKey = env.TOKEN_ENC_KEY ?? '';
  const ready = (env.OAUTH_CLIENT_ID ?? '') !== '' && (env.OAUTH_CLIENT_SECRET ?? '') !== '' && secret.length >= 32 && encKey.length === 64;
  const jarOf = (request: Request) => cookieJar(request.url, env.ENV);

  const clientFor = (request: Request): OAuthClient => ({
    clientId: env.OAUTH_CLIENT_ID ?? '',
    clientSecret: env.OAUTH_CLIENT_SECRET ?? '',
    redirectUri: `${new URL(request.url).origin}/oauth/callback`,
  });

  const problem = (request: Request, message: string, status: number) =>
    html(page('Sign in', `<h1>Sign in with Cloudflare</h1><p class="error">${escapeHtml(message)}</p><p><a class="button" href="/oauth/login">Try again</a></p>`), status, {
      'set-cookie': clearCookie(jarOf(request), jarOf(request).flow),
    });

  const notReady = (request: Request) => problem(request, 'Sign in with Cloudflare is not configured on this instance yet.', 503);

  const login = async (request: Request) => {
    if (!ready) return notReady(request);
    const flow: Flow = { state: randomToken(), verifier: randomToken(48), expires: Date.now() + FLOW_TTL_MS, back: safeReturn(new URL(request.url).searchParams.get('return')) };
    const jar = jarOf(request);
    return redirect(await authorizeUrl(clientFor(request), flow.state, flow.verifier), [cookie(jar, jar.flow, await sign(secret, JSON.stringify(flow)), FLOW_TTL_MS)]);
  };

  const callback = async (request: Request) => {
    if (!ready) return notReady(request);
    const url = new URL(request.url);
    const jar = jarOf(request);
    const denied = url.searchParams.get('error');
    if (denied !== null) return problem(request, `Cloudflare did not sign you in: ${url.searchParams.get('error_description') ?? denied}`, 400);
    const flow = parseFlow(await unsign(secret, readCookie(request, jar.flow)));
    const code = url.searchParams.get('code');
    if (flow === null || code === null || url.searchParams.get('state') !== flow.state) return problem(request, 'That sign-in link expired or did not start here. Try again.', 400);
    try {
      const tokens = await exchangeCode(clientFor(request), code, flow.verifier, send);
      const user = await userInfo(tokens.accessToken, send);
      const accounts = await accountsOf(tokens.accessToken, send);
      if (accounts.length === 0) return problem(request, 'You did not give gleam-agents access to any Cloudflare account. Sign in again and pick one.', 403);
      const owner = `${OWNER_PREFIX}${user.sub}`;
      const only = accounts.length === 1 ? accounts[0] : undefined;
      await grants(owner).put({
        owner,
        email: user.email,
        accountId: only?.id ?? '',
        accountName: only?.name ?? '',
        sealedAccess: await seal(encKey, tokens.accessToken),
        sealedRefresh: tokens.refreshToken === null ? null : await seal(encKey, tokens.refreshToken),
        expiresAt: tokens.expiresAt,
        scope: tokens.scope,
      });
      const session = { owner, id: randomToken(), expires: Date.now() + SESSION_TTL_MS };
      await directory().openSession(session.id, owner, session.expires);
      const next = only === undefined ? `/oauth/account?return=${encodeURIComponent(flow.back)}` : flow.back;
      return redirect(next, [clearCookie(jar, jar.flow), cookie(jar, jar.session, await sign(secret, sessionValue(session)), SESSION_TTL_MS)]);
    } catch (cause) {
      if (cause instanceof OAuthFailed) return problem(request, cause.message, 502);
      throw cause;
    }
  };

  const fromSession = async (request: Request): Promise<{ owner: string; id: string } | null> => {
    if (!ready) return null;
    const session = parseSession(await unsign(secret, readCookie(request, jarOf(request).session)));
    if (session === null) return null;
    return (await directory().sessionOwner(session.id)) === session.owner ? { owner: session.owner, id: session.id } : null;
  };

  const fromBearer = async (request: Request): Promise<string | null> => {
    const header = request.headers.get('authorization') ?? '';
    if (!header.startsWith('Bearer ga_')) return null;
    return directory().cliTokenOwner(await sha256(header.slice('Bearer '.length)));
  };

  const grantOf = (owner: string): Promise<SealedGrant | null> => grants(owner).get();

  const signedIn = async (request: Request): Promise<Signed | null> => {
    const session = await fromSession(request);
    const owner = session?.owner ?? (await fromBearer(request));
    if (owner === null || owner === undefined) return null;
    const grant = await grantOf(owner);
    if (grant === null || grant.accountId === '') return null;
    return { owner, sessionId: session?.id ?? null };
  };

  const accountChoice = async (request: Request) => {
    const session = await fromSession(request);
    if (session === null) return redirect('/oauth/login');
    const grant = await grantOf(session.owner);
    if (grant === null) return redirect('/oauth/login');
    const accounts = await accountsOf(await open(encKey, grant.sealedAccess), send);
    const back = safeReturn(new URL(request.url).searchParams.get('return'));
    if (request.method === 'GET') {
      const items = accounts
        .map((a) => `<li><form method="post"><input type="hidden" name="account" value="${escapeHtml(a.id)}"><button type="submit">${escapeHtml(a.name)}</button> <code>${escapeHtml(a.id.slice(0, 8))}…</code></form></li>`)
        .join('');
      return html(page('Pick an account', `<h1>Pick one account</h1><p>Your sign-in can see ${accounts.length} accounts. gleam-agents acts on exactly one. Nothing is saved until you pick.</p><ul class="accounts">${items}</ul>`));
    }
    if (!sameOrigin(request)) return new Response('cross-origin request refused', { status: 403 });
    const chosen = String((await request.formData()).get('account') ?? '');
    const account = accounts.find((a) => a.id === chosen);
    if (account === undefined) return new Response('pick an account from the list', { status: 400 });
    await grants(session.owner).put({ ...grant, accountId: account.id, accountName: account.name });
    return redirect(back, [], 303);
  };

  const logout = async (request: Request) => {
    if (!sameOrigin(request)) return new Response('cross-origin request refused', { status: 403 });
    const session = await fromSession(request);
    if (session !== null) {
      const grant = await grantOf(session.owner);
      await directory().closeOwner(session.owner);
      if (grant !== null) {
        await revoke(clientFor(request), await open(encKey, grant.sealedRefresh ?? grant.sealedAccess), send);
        await grants(session.owner).drop();
      }
    }
    return redirect('/', [clearCookie(jarOf(request), jarOf(request).session)], 303);
  };

  const me = async (request: Request) => {
    const who = await signedIn(request);
    if (who === null) return Response.json({ signedIn: false }, { status: 401 });
    const grant = await grantOf(who.owner);
    return Response.json({ signedIn: true, email: grant?.email ?? null, account: grant?.accountName ?? null, via: who.sessionId === null ? 'cli-token' : 'session' });
  };

  const cliStart = async (request: Request) => {
    const id = randomHex(16);
    const code = randomHex(3).toUpperCase();
    await directory().startCliLogin(id, code, Date.now() + CLI_LOGIN_TTL_MS);
    const origin = new URL(request.url).origin;
    return Response.json({ id, code, approve: `${origin}/cli/approve?id=${id}&code=${code}`, expiresInSec: CLI_LOGIN_TTL_MS / 1000 });
  };

  const cliApprove = async (request: Request) => {
    const url = new URL(request.url);
    const id = url.searchParams.get('id') ?? '';
    const code = url.searchParams.get('code') ?? '';
    const who = await signedIn(request);
    if (who === null || who.sessionId === null) return redirect(`/oauth/login?return=${encodeURIComponent(`/cli/approve?id=${id}&code=${code}`)}`);
    const pending = await directory().cliLogin(id);
    if (pending === null) return html(page('Expired', '<h1>That login request expired</h1><p>Run <code>/gleam-agents login</code> again.</p>'), 410);
    if (request.method === 'GET') {
      return html(page('Approve CLI', `<h1>Let a CLI act as you?</h1><p>A Pi session asked to publish eval reports as you. Check that your terminal shows the code <strong class="code">${escapeHtml(pending.code)}</strong>.</p><form method="post"><button type="submit">Approve</button></form><p class="muted">The token lasts 30 days. Sign out to revoke every token.</p>`, { signedIn: true }));
    }
    if (!sameOrigin(request)) return new Response('cross-origin request refused', { status: 403 });
    const ok = await directory().approveCliLogin(id, code, who.owner);
    return html(page('Approved', ok ? '<h1>Approved</h1><p>Go back to your terminal.</p>' : '<h1>Not approved</h1><p>The code did not match or was already used.</p>', { signedIn: true }), ok ? 200 : 400);
  };

  const cliFinish = async (request: Request) => {
    const body = (await request.json().catch(() => null)) as { id?: unknown; label?: unknown } | null;
    const id = typeof body?.id === 'string' ? body.id : '';
    const owner = await directory().finishCliLogin(id);
    if (owner === null) return Response.json({ status: 'pending' }, { status: 202 });
    const token = `ga_${randomHex(32)}`;
    const label = typeof body?.label === 'string' ? body.label.slice(0, 80) : 'cli';
    await directory().saveCliToken(await sha256(token), owner, label, Date.now() + CLI_TOKEN_TTL_MS);
    return Response.json({ status: 'approved', token, expiresInSec: CLI_TOKEN_TTL_MS / 1000 });
  };

  const routes = async (request: Request): Promise<Response | null> => {
    const { pathname } = new URL(request.url);
    const method = request.method;
    if (pathname === '/oauth/login' && method === 'GET') return login(request);
    if (pathname === '/oauth/callback' && method === 'GET') return callback(request);
    if (pathname === '/oauth/logout' && method === 'POST') return logout(request);
    if (pathname === '/oauth/me' && method === 'GET') return me(request);
    if (pathname === '/oauth/account' && (method === 'GET' || method === 'POST')) return accountChoice(request);
    if (pathname === '/cli/start' && method === 'POST') return cliStart(request);
    if (pathname === '/cli/approve' && (method === 'GET' || method === 'POST')) return cliApprove(request);
    if (pathname === '/cli/finish' && method === 'POST') return cliFinish(request);
    return null;
  };

  return { ready, routes, signedIn };
};

export const escapeHtml = (text: string) =>
  text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
