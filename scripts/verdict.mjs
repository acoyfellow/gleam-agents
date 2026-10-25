import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const dir = process.argv[2] ?? "proof/eval";
const score = JSON.parse(readFileSync(join(dir, "score.json"), "utf8"));
const baseline = JSON.parse(readFileSync("evals/baseline-hard-final.json", "utf8"));
const rows = baseline.rows.filter((r) => r.spec === "haiku45-full");
const baseRate = rows.filter((r) => r.hidden).length / rows.length;
const ours = score.passed / score.seats;
const threshold = Math.round((baseRate - 0.15) * 1000) / 1000;
const verdict = {
  claim: "gleam-agents native harness hidden pass rate on bench/hard >= Elixir swarm baseline - 0.15, same model",
  metric: "hidden pass rate, bench/hard 17 tasks",
  ours: Math.round(ours * 1000) / 1000,
  ours_counts: `${score.passed}/${score.seats}`,
  baseline: Math.round(baseRate * 1000) / 1000,
  baseline_counts: `${rows.filter((r) => r.hidden).length}/${rows.length}`,
  threshold,
  verdict: ours >= threshold ? "proven" : "disproven",
  ours_usd_per_seat: Math.round((score.usd / score.seats) * 10000) / 10000,
  baseline_usd_per_seat: Math.round((rows.reduce((s, r) => s + r.usd, 0) / rows.length) * 10000) / 10000,
  runs: 1,
};
writeFileSync(join(dir, "verdict.json"), JSON.stringify(verdict, null, 1));
console.log(JSON.stringify(verdict));
