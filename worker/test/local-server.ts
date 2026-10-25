import { createServer } from 'node:http';
import { vi } from 'vitest';
import { fakeCloudflare } from './fake-cloudflare';

vi.mock('cloudflare:workers', () => ({ DurableObject: class { constructor(public ctx: unknown, public env: unknown) {} } }));

export const startLocal = async (makeEnv: () => never, port: number) => {
  const { handle } = await import('../src/index');
  const env = makeEnv();
  const fake = fakeCloudflare({ accounts: [{ id: 'acct-1', name: 'Test account' }] });
  const origin = `http://127.0.0.1:${port}`;
  const server = createServer(async (req, res) => {
    const chunks: Buffer[] = [];
    for await (const c of req) chunks.push(c as Buffer);
    const body = chunks.length ? Buffer.concat(chunks) : undefined;
    const request = new Request(`https://gleam-agents.coey.dev${req.url}`, { method: req.method, headers: req.headers as HeadersInit, body: req.method === 'GET' || req.method === 'HEAD' ? undefined : body });
    const response = await handle(request, env, fake.send);
    res.statusCode = response.status;
    response.headers.forEach((v, k) => res.setHeader(k, v));
    res.end(Buffer.from(await response.arrayBuffer()));
  });
  await new Promise<void>((r) => server.listen(port, '127.0.0.1', r));
  return { origin, env, close: () => server.close() };
};
