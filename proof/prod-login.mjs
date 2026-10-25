import { writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

const BASE = "https://gleam-agents.coey.dev";
const tokenFile = process.env.GLEAM_AGENTS_TOKEN_FILE;
const surface = process.argv[2] ?? "surface:627";
const start = await (await fetch(`${BASE}/cli/start`, { method: "POST" })).json();
console.log(`code ${start.code}; opening approve link in ${surface}`);
execFileSync("cmux", ["browser", surface, "goto", start.approve]);
const until = Date.now() + 240_000;
while (Date.now() < until) {
  await new Promise((r) => setTimeout(r, 3000));
  const r = await fetch(`${BASE}/cli/finish`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: start.id, label: "prod-receipt" }) });
  if (r.status === 200) {
    const { token } = await r.json();
    writeFileSync(tokenFile, token, { mode: 0o600 });
    console.log("token saved");
    process.exit(0);
  }
}
console.log("timed out");
process.exit(1);
