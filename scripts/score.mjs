import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const dir = process.argv[2];
if (!dir) throw new Error("usage: node scripts/score.mjs <run dir>");
const items = readdirSync(join(dir, "items"))
  .filter((f) => f.endsWith(".json") && !f.includes(".pi-"))
  .map((f) => JSON.parse(readFileSync(join(dir, "items", f), "utf8")));
const run = JSON.parse(readFileSync(join(dir, "run.json"), "utf8"));
const recomputed = {
  plan: run.plan,
  baseline: run.baseline,
  seats: run.seats,
  graded: items.length,
  passed: items.filter((i) => i.graded_pass).length,
  visible_passed: items.filter((i) => i.visible_pass).length,
  scope_denials: items.reduce((s, i) => s + i.scope_denials, 0),
  usd: Math.round(items.reduce((s, i) => s + i.usd, 0) * 10000) / 10000,
  wall_ms: run.wall_ms,
  errors: run.errors,
  per_seat: items.map(({ seat, shape, goal, outcome, turns, tests_run, scope_denials, usd, ms, visible_pass, graded_pass }) => ({ seat, shape, goal, outcome, turns, tests_run, scope_denials, usd, ms, visible_pass, graded_pass })),
};
const agrees = recomputed.passed === run.passed && recomputed.graded === run.graded;
writeFileSync(join(dir, "score.json"), JSON.stringify({ ...recomputed, agrees_with_run_json: agrees }, null, 1));
console.table(recomputed.per_seat);
console.log(`passed ${recomputed.passed}/${recomputed.seats} · $${recomputed.usd} · ${(recomputed.wall_ms / 1000).toFixed(1)} s · recompute agrees: ${agrees}`);
if (!agrees) process.exit(1);
