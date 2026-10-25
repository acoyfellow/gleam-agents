import { Marked } from 'marked';
import { authFor, escapeHtml, type AuthEnv } from './auth/cloudflare';
import { randomHex } from './crypto';
import { DOCS } from './docs.generated';
import { DIRECTORY_NAME, type Report } from './objects';
import { page } from './pages/layout';

export { Directory, Grant } from './objects';

type Env = AuthEnv & { readonly ASSETS?: Fetcher };

const html = (body: string, status = 200) =>
  new Response(body, { status, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });

const text = (body: string, type = 'text/plain; charset=utf-8') =>
  new Response(body, { headers: { 'content-type': type, 'cache-control': 'public, max-age=300' } });

const MAX_REPORT_BYTES = 256 * 1024;

const docPage = (slug: string, signedIn: boolean): Response | null => {
  const doc = DOCS.find((d) => d.slug === slug);
  if (doc === undefined) return null;
  const nav = DOCS.map((d) => `<a href="${d.slug === 'index' ? '/docs' : `/docs/${d.slug}`}"${d.slug === slug ? ' style="color:var(--accent)"' : ''}>${escapeHtml(d.title)}</a>`).join(' · ');
  return html(page(doc.title, `<p class="muted">${nav}</p>${doc.html}`, { signedIn }));
};

const landing = (signedIn: boolean) => {
  const intro = DOCS.find((d) => d.slug === 'index');
  return page(
    'Run N coding agents, graded by real benchmarks',
    `<h1>Run N coding agents. Each with its own goal, shape and file scope.</h1>
<p>Graded by benchmarks they can not see: <code>bench/hard</code> hidden tests and the <a href="https://github.com/cloudflare/cf-build-bench">cf-build-bench</a> gate. Written in Gleam on the BEAM.</p>
<div class="cards">
<div class="card"><h3>Catalog</h3><p>Shapes: model, harness, tools, budget. <a href="/docs/catalog">Read</a></p></div>
<div class="card"><h3>Scope</h3><p>Writes outside the list are refused and counted. <a href="/docs/scope">Read</a></p></div>
<div class="card"><h3>Reports</h3><p>Every published run, recomputed from per-seat receipts. <a href="/reports">Open</a></p></div>
</div>
<p><a class="button" href="/docs">Read the docs</a> ${signedIn ? '' : '<a href="/oauth/login" style="margin-left:10px">Sign in with Cloudflare</a>'}</p>
<p class="muted">This site is docs and published reports only. It runs no agents and calls no models.</p>
${intro ? `<hr style="border:0;border-top:1px solid var(--line);margin:28px 0">${intro.html}` : ''}`,
    { signedIn },
  );
};

const llmsTxt = () =>
  [
    '# gleam-agents',
    '',
    '> Run N coding agents with their own goals, shapes and file scopes, graded by real benchmarks. Gleam on the BEAM. This site is docs and published reports only.',
    '',
    ...DOCS.map((d) => `- [${d.title}](https://gleam-agents.coey.dev${d.slug === 'index' ? '/docs' : `/docs/${d.slug}`}.md)`),
    '- [Reports](https://gleam-agents.coey.dev/api/reports): JSON list of published eval reports',
    '',
    '## Full docs',
    '',
    ...DOCS.map((d) => d.markdown),
  ].join('\n');

type SeatRow = { seat?: unknown; shape?: unknown; outcome?: unknown; turns?: unknown; usd?: unknown; graded_pass?: unknown };

const seatTable = (summary: unknown): string => {
  const seats = (summary as { per_seat?: unknown }).per_seat;
  if (!Array.isArray(seats) || seats.length === 0) return '';
  const rows = (seats as SeatRow[])
    .map((s) => `<tr><td>${escapeHtml(String(s.seat ?? ''))}</td><td>${escapeHtml(String(s.shape ?? ''))}</td><td>${escapeHtml(String(s.outcome ?? ''))}</td><td>${escapeHtml(String(s.turns ?? ''))}</td><td>${escapeHtml(String(s.usd ?? ''))}</td><td>${s.graded_pass === true ? 'pass' : 'fail'}</td></tr>`)
    .join('');
  return `<h2>Every seat</h2><table><thead><tr><th>Seat</th><th>Shape</th><th>Outcome</th><th>Turns</th><th>$</th><th>Hidden</th></tr></thead><tbody>${rows}</tbody></table>`;
};

const reportsPage = (reports: Omit<Report, 'markdown' | 'owner'>[], signedIn: boolean) => {
  const rows = reports
    .map((r) => {
      const s = r.summary as { passed?: number; seats?: number; usd?: number };
      return `<tr><td><a href="/reports/${r.id}">${escapeHtml(r.title)}</a></td><td>${s.passed ?? '?'}/${s.seats ?? '?'}</td><td>$${s.usd ?? '?'}</td><td class="muted">${new Date(r.createdAt).toISOString().slice(0, 16).replace('T', ' ')} UTC</td></tr>`;
    })
    .join('');
  return page('Reports', `<h1>Reports</h1><p>Each report is a run's <code>score.json</code>, recomputed from per-seat receipts, plus notes. Published from the Pi extension.</p>${reports.length ? `<table><thead><tr><th>Report</th><th>Passed</th><th>Cost</th><th>When</th></tr></thead><tbody>${rows}</tbody></table>` : '<p class="muted">No reports yet.</p>'}`, { signedIn });
};

const safeHref = (href: string) => (/^(https?:\/\/|\/|#)/u.test(href) ? href : '#');

const reportRenderer = new Marked({
  renderer: {
    html: ({ text }) => escapeHtml(text),
    link: ({ href, text }) => `<a href="${escapeHtml(safeHref(href))}" rel="nofollow noopener">${escapeHtml(text)}</a>`,
    image: ({ text }) => escapeHtml(text),
  },
});

const renderMarkdown = (markdown: string) => `<div class="report-notes">${reportRenderer.parse(markdown, { async: false })}</div>`;

const validReport = (body: unknown): { title: string; summary: Record<string, unknown>; markdown: string } | null => {
  if (typeof body !== 'object' || body === null) return null;
  const { title, summary, markdown } = body as Record<string, unknown>;
  if (typeof title !== 'string' || title.trim() === '' || title.length > 160) return null;
  if (typeof summary !== 'object' || summary === null || Array.isArray(summary)) return null;
  if (typeof markdown !== 'string') return null;
  return { title: title.trim(), summary: summary as Record<string, unknown>, markdown };
};

export const handle = async (request: Request, env: Env, send: typeof fetch = fetch): Promise<Response> => {
    const url = new URL(request.url);
    const { pathname } = url;
    const auth = authFor(env, send);

    if (pathname === '/robots.txt') return text('User-agent: *\nAllow: /\n');
    if (pathname === '/llms.txt') return text(llmsTxt());
    if (pathname === '/healthz') return Response.json({ ok: true, authReady: auth.ready, docs: DOCS.length });

    const own = await auth.routes(request);
    if (own !== null) return own;

    const who = await auth.signedIn(request);
    const signedIn = who !== null;

    if (pathname === '/' && request.method === 'GET') return html(landing(signedIn));
    if (pathname === '/docs' || pathname === '/docs/') return docPage('index', signedIn) ?? html('missing', 500);
    if (pathname.startsWith('/docs/')) {
      const slug = pathname.slice('/docs/'.length).replace(/\.md$/u, '');
      const doc = DOCS.find((d) => d.slug === slug);
      if (doc && pathname.endsWith('.md')) return text(doc.markdown, 'text/markdown; charset=utf-8');
      return docPage(slug, signedIn) ?? html(page('Not found', '<h1>Not found</h1>', { signedIn }), 404);
    }
    if (pathname === '/docs.md') return text(DOCS.find((d) => d.slug === 'index')?.markdown ?? '', 'text/markdown; charset=utf-8');

    const directory = env.DIRECTORY.getByName(DIRECTORY_NAME);

    if (pathname === '/reports' && request.method === 'GET') return html(reportsPage((await directory.listReports()) as Omit<Report, 'markdown' | 'owner'>[], signedIn));
    if (pathname.startsWith('/reports/') && request.method === 'GET') {
      const report = (await directory.report(pathname.slice('/reports/'.length))) as Omit<Report, 'owner'> | null;
      if (report === null) return html(page('Not found', '<h1>No such report</h1>', { signedIn }), 404);
      return html(page(report.title, `<h1>${escapeHtml(report.title)}</h1><p class="muted">${new Date(report.createdAt).toISOString()}</p>${renderMarkdown(report.markdown)}${seatTable(report.summary)}<details><summary>Recomputed score.json</summary><pre>${escapeHtml(JSON.stringify(report.summary, null, 2))}</pre></details><p class="muted"><a href="/api/reports/${escapeHtml(report.id)}">JSON</a></p>`, { signedIn }));
    }

    if (pathname === '/api/reports' && request.method === 'GET') return Response.json(await directory.listReports());
    if (pathname.startsWith('/api/reports/') && request.method === 'GET') {
      const report = await directory.report(pathname.slice('/api/reports/'.length));
      return report === null ? Response.json({ error: 'not found' }, { status: 404 }) : Response.json(report);
    }
    if (pathname === '/api/reports' && request.method === 'POST') {
      if (who === null) return Response.json({ error: 'sign in with Cloudflare first', login: '/oauth/login' }, { status: 401 });
      const raw = await request.text();
      if (raw.length > MAX_REPORT_BYTES) return Response.json({ error: 'report too large' }, { status: 413 });
      const body = validReport(JSON.parse(raw || 'null'));
      if (body === null) return Response.json({ error: 'need title, summary (object) and markdown' }, { status: 400 });
      const id = `${new Date().toISOString().slice(0, 10)}-${randomHex(4)}`;
      await directory.saveReport({ id, owner: who.owner, title: body.title, createdAt: Date.now(), summary: body.summary, markdown: body.markdown });
      return Response.json({ id, url: `${url.origin}/reports/${id}` }, { status: 201 });
    }
    if (pathname.startsWith('/api/')) return Response.json({ error: 'not found' }, { status: 404 });

    return html(page('Not found', '<h1>Not found</h1>', { signedIn }), 404);
};

export default {
  fetch: (request: Request, env: Env): Promise<Response> => handle(request, env),
};
