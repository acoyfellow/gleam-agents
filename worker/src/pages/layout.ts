const STYLE = `
:root{--bg:#0d0f12;--fg:#e9edf2;--muted:#9aa4b1;--line:#232832;--accent:#ffb000;--ok:#7ee787;--bad:#ff7b72;--code:#151922}
*{box-sizing:border-box}html,body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.55 "Google Sans Flex","Google Sans",system-ui,sans-serif}
a{color:var(--accent)}main{max-width:820px;margin:0 auto;padding:24px 18px 80px}
header.top{display:flex;gap:16px;align-items:center;justify-content:space-between;padding:14px 18px;border-bottom:1px solid var(--line);flex-wrap:wrap}
header.top nav{display:flex;gap:14px;flex-wrap:wrap}header.top nav a{color:var(--fg);text-decoration:none}header.top nav a:hover{color:var(--accent)}
.brand{font-weight:700;letter-spacing:.2px;color:var(--fg);text-decoration:none}.brand span{color:var(--accent)}
h1{font-size:30px;line-height:1.2;margin:18px 0 10px}h2{font-size:21px;margin:28px 0 8px}h3{font-size:17px;margin:20px 0 6px}
code,pre{font-family:"Google Sans Code",ui-monospace,Menlo,monospace;font-size:14px}code{background:var(--code);padding:1px 5px;border-radius:4px}
pre{background:var(--code);padding:12px 14px;border-radius:8px;overflow-x:auto;border:1px solid var(--line)}pre code{background:none;padding:0}
table{border-collapse:collapse;width:100%;display:block;overflow-x:auto;font-size:14px}th,td{border-bottom:1px solid var(--line);padding:6px 8px;text-align:left;vertical-align:top}
.button,button{display:inline-block;background:var(--accent);color:#111;border:0;border-radius:8px;padding:10px 16px;font:inherit;font-weight:600;text-decoration:none;cursor:pointer}
.muted{color:var(--muted)}.error{color:var(--bad)}.ok{color:var(--ok)}.code{font-size:22px;letter-spacing:3px}
ul.accounts{list-style:none;padding:0}ul.accounts li{margin:8px 0}ul.accounts form{display:flex;gap:10px;align-items:center}
.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;margin:16px 0}.card{border:1px solid var(--line);border-radius:10px;padding:14px}
.card h3{margin-top:0}footer{border-top:1px solid var(--line);padding:18px;color:var(--muted);font-size:14px;text-align:center}
`;

export type Nav = { readonly signedIn: boolean };

export const page = (title: string, body: string, nav: Nav = { signedIn: false }, description = 'Run N coding agents with their own goals and file scopes, graded by real benchmarks. Gleam on the BEAM.') => `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title} · gleam-agents</title><meta name="description" content="${description}">
<meta property="og:title" content="${title} · gleam-agents"><meta property="og:description" content="${description}">
<meta property="og:image" content="https://gleam-agents.coey.dev/og.png"><meta name="twitter:card" content="summary_large_image">
<link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Google+Sans+Code&family=Google+Sans+Flex:wght@400;600;700&display=swap" rel="stylesheet">
<style>${STYLE}</style></head><body>
<header class="top"><a class="brand" href="/">gleam<span>-</span>agents</a>
<nav><a href="/docs">Docs</a><a href="/reports">Reports</a><a href="/llms.txt">llms.txt</a><a href="https://github.com/acoyfellow/gleam-agents">Source</a>${
  nav.signedIn
    ? '<form method="post" action="/oauth/logout" style="display:inline"><button type="submit" style="padding:4px 10px">Sign out</button></form>'
    : '<a href="/oauth/login">Sign in</a>'
}</nav></header>
<main>${body}</main>
<footer>An experiment by <a href="https://coey.dev">Jordan Coeyman</a>. This site is docs and published reports only. Agents run on your machine.</footer>
</body></html>`;
