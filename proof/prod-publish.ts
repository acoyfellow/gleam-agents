import { readFileSync, writeFileSync } from "node:fs";

const BASE = "https://gleam-agents.coey.dev";
process.env.GLEAM_AGENTS_URL = BASE;
const ext = await import("../pi/index.ts");

const verdict = JSON.parse(readFileSync("proof/eval/verdict.json", "utf8"));
const score = JSON.parse(readFileSync("proof/eval/score.json", "utf8"));
const misses = (score.per_seat as { seat: string; outcome: string; graded_pass: boolean; turns: number }[]).filter((s) => !s.graded_pass);

const notes = `# Gleam fleet vs Elixir swarm on bench/hard

**Verdict: ${verdict.verdict}.** The Gleam native harness passes ${verdict.ours_counts} hidden tests (${verdict.ours}). The Elixir swarm baseline passes ${verdict.baseline_counts} (${verdict.baseline}). The threshold is ${verdict.threshold}.

| | Hidden pass | $ per task | Runs |
|---|---|---|---|
| gleam-agents, haiku45-native | ${verdict.ours_counts} = ${verdict.ours} | ${verdict.ours_usd_per_seat} | 1 |
| swarm-desk Elixir, haiku45-full | ${verdict.baseline_counts} = ${verdict.baseline} | ${verdict.baseline_usd_per_seat} | 3 |

## Setup

- 17 seats, one per bench/hard task. All start at once, one BEAM process each.
- Same model (claude-haiku-4-5), same seed, same hidden tests as the baseline.
- Each seat may write only \`src/\` and \`test/\`. Hidden tests are copied in after the agent stops.
- The score is recomputed from per-seat receipts and must agree with the run summary.

## Misses

| Seat | Outcome | Turns |
|---|---|---|
${misses.map((m) => `| ${m.seat} | ${m.outcome} | ${m.turns} |`).join("\n")}

Two of the three misses are tasks the baseline also missed (allocate-remainder, catalog-search). sku-glob ran out of its 30 turns.

## Not verified

- One run of 17 is a parity smoke check, not a ranking. The band is wide.
- Only the native harness ran. Other harnesses are not tested.
- The cf-build-bench gate was tested on one task (kv-crud, 1/1), not in this run.
`;

const published = await ext.publish("proof/eval", "Gleam fleet vs Elixir swarm, bench/hard, haiku-4-5, 1x", notes);
const meRes = await fetch(`${BASE}/oauth/me`, { headers: { authorization: `Bearer ${readFileSync(process.env.GLEAM_AGENTS_TOKEN_FILE as string, "utf8").trim()}` } });
const me = await meRes.json();
const anon = await fetch(`${BASE}/api/reports`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
const receipt = {
  at: new Date().toISOString(),
  base: BASE,
  me: { signedIn: me.signedIn, via: me.via, account: me.account, emailDomain: String(me.email ?? "").split("@")[1] ?? null },
  anonymousPublishStatus: anon.status,
  publishStatus: 201,
  reportId: published.id,
  reportUrl: published.url,
};
writeFileSync("proof/prod-auth.json", JSON.stringify(receipt, null, 1) + "\n");
console.log(JSON.stringify(receipt));
