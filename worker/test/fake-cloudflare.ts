export type FakeOptions = { readonly accounts: readonly { id: string; name: string }[] };

export const fakeCloudflare = (options: FakeOptions) => {
  const issued = new Set<string>();
  const revoked: string[] = [];
  const send: typeof fetch = async (input, init) => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url);
    const auth = new Headers(init?.headers).get('authorization') ?? '';
    if (url.pathname === '/oauth2/token') {
      const token = `at-${issued.size + 1}`;
      issued.add(token);
      return Response.json({ access_token: token, refresh_token: `rt-${issued.size}`, expires_in: 3600, scope: 'offline_access user-details.read account-settings.read ai.read aig.read aig.run' });
    }
    if (url.pathname === '/oauth2/userinfo') {
      if (!issued.has(auth.replace('Bearer ', ''))) return new Response('no', { status: 401 });
      return Response.json({ sub: 'user-1' });
    }
    if (url.pathname === '/client/v4/user') return Response.json({ success: true, result: { id: 'user-1', email: 'person@example.com' } });
    if (url.pathname === '/client/v4/accounts') return Response.json({ success: true, result: options.accounts });
    if (url.pathname === '/oauth2/revoke') {
      revoked.push(new URLSearchParams(String(init?.body ?? '')).get('token') ?? '');
      return new Response(null, { status: 200 });
    }
    return new Response('unexpected ' + url.pathname, { status: 599 });
  };
  return { send, revoked };
};
