const encoder = new TextEncoder();

const keyFor = (secret: string) =>
  crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, [
    'sign',
    'verify',
  ]);

const hex = (bytes: ArrayBuffer) =>
  [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, '0')).join('');

const fromHex = (value: string) => {
  const pairs = value.match(/.{2}/gu) ?? [];

  return new Uint8Array(pairs.map((pair) => Number.parseInt(pair, 16)));
};

export type CookieJar = {
  readonly session: string;
  readonly flow: string;
  readonly secure: boolean;
};

export const cookieJar = (requestUrl: string, env: string | undefined): CookieJar => {
  const relaxed = env === 'dev' && new URL(requestUrl).hostname === 'localhost';
  const secure = !relaxed;
  const prefix = secure ? '__Host-' : '';

  return { session: `${prefix}ga_session`, flow: `${prefix}ga_oauth`, secure };
};

export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export const FLOW_TTL_MS = 10 * 60 * 1000;

const SEPARATOR = '.';

export const sign = async (secret: string, payload: string): Promise<string> => {
  const body = btoa(payload);
  const signature = await crypto.subtle.sign('HMAC', await keyFor(secret), encoder.encode(body));

  return `${body}${SEPARATOR}${hex(signature)}`;
};

export const unsign = async (secret: string, value: string | null): Promise<string | null> => {
  if (value === null) return null;

  const at = value.lastIndexOf(SEPARATOR);

  if (at <= 0) return null;

  const body = value.slice(0, at);
  const signature = fromHex(value.slice(at + 1));
  const valid = await crypto.subtle.verify(
    'HMAC',
    await keyFor(secret),
    signature,
    encoder.encode(body),
  );

  if (!valid) return null;

  try {
    return atob(body);
  } catch {
    return null;
  }
};

export const readCookie = (request: Request, name: string): string | null => {
  const header = request.headers.get('cookie') ?? '';

  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=');

    if (key === name) return decodeURIComponent(rest.join('='));
  }

  return null;
};

const attributes = (jar: CookieJar) =>
  `Path=/; HttpOnly;${jar.secure ? ' Secure;' : ''} SameSite=Lax`;

export const cookie = (jar: CookieJar, name: string, value: string, maxAgeMs: number) =>
  `${name}=${encodeURIComponent(value)}; ${attributes(jar)}; Max-Age=${Math.floor(maxAgeMs / 1000)}`;

export const clearCookie = (jar: CookieJar, name: string) =>
  `${name}=; ${attributes(jar)}; Max-Age=0`;

const parseExpiring =
  <A extends { readonly expires: number }>(keys: readonly (keyof A)[]) =>
  (raw: string | null, now = Date.now()): A | null => {
    if (raw === null) return null;
    try {
      const value: unknown = JSON.parse(raw);
      if (typeof value !== 'object' || value === null) return null;
      const record = value as Record<string, unknown>;
      if (typeof record.expires !== 'number' || record.expires <= now) return null;
      if (!keys.every((key) => typeof record[key as string] === 'string')) return null;
      return value as A;
    } catch {
      return null;
    }
  };

export type Session = { readonly owner: string; readonly id: string; readonly expires: number };

export const sessionValue = (session: Session) => JSON.stringify(session);

export const parseSession = parseExpiring<Session>(['owner', 'id']);

export type Flow = { readonly state: string; readonly verifier: string; readonly expires: number; readonly back: string };

export const parseFlow = parseExpiring<Flow>(['state', 'verifier', 'back']);
