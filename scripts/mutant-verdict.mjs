import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const [run, out] = process.argv.slice(2);
const threshold = 0.5;
const rows = [];
for (const f of readdirSync(join(run, "items")).filter((f) => f.endsWith(".json") && !f.includes(".pi-"))) {
  const item = JSON.parse(readFileSync(join(run, "items", f), "utf8"));
  let m = null;
  try { m = JSON.parse(readFileSync(join(out, "raw", f), "utf8")); } catch {}
  rows.push({ seat: item.seat, hidden_pass: item.graded_pass, visible_pass: item.visible_pass, mutants: m?.evaluated ?? 0, score: m && m.evaluated > 0 ? Math.round(m.score * 1000) / 1000 : null });
}
const scored = rows.filter((r) => r.score !== null && r.visible_pass);
const flagged = scored.filter((r) => r.score < threshold);
const wrong = scored.filter((r) => !r.hidden_pass);
const caught = wrong.filter((r) => r.score < threshold);
const falseAlarms = flagged.filter((r) => r.hidden_pass);
const rate = (xs, pred) => (xs.length ? Math.round((xs.filter(pred).length / xs.length) * 1000) / 1000 : null);
const verdict = {
  claim: "on agent-written code, mutant score < 0.5 flags the seats whose visible tests pass but hidden tests fail",
  metric: "wrong ships caught / wrong ships, and false alarms / flagged",
  threshold,
  seats_scored: scored.length,
  wrong_ships: wrong.length,
  caught: caught.length,
  flagged: flagged.length,
  false_alarms: falseAlarms.length,
  wrong_rate_when_flagged: rate(flagged, (r) => !r.hidden_pass),
  wrong_rate_when_not_flagged: rate(scored.filter((r) => r.score >= threshold), (r) => !r.hidden_pass),
  rows,
};
verdict.verdict =
  wrong.length === 0 ? "inconclusive: no wrong ships to catch" :
  caught.length / wrong.length >= 0.5 && (verdict.wrong_rate_when_flagged ?? 0) > (verdict.wrong_rate_when_not_flagged ?? 0) ? "proven" : "disproven";
writeFileSync(join(out, "verdict.json"), JSON.stringify(verdict, null, 1));
console.log(JSON.stringify({ ...verdict, rows: undefined }));
