import { readFileSync } from "node:fs";

const status = JSON.parse(readFileSync("status.json", "utf8")).roadmap;
const doc = readFileSync("docs/roadmap.md", "utf8");
const names = {
  "native-harness": "Native harness", "cf-build-bench-grader": "cf-build-bench grader", "scope-guard-native": "Scope guard (native)",
  "pi-harness": "Pi harness", "scope-guard-pi": "Scope guard (Pi)", "mcp-in-shapes": "MCP in shapes", resume: "Resume",
  "edge-workspaces": "Edge workspaces", "mutant-judge": "Mutant judge", "other-harnesses": "Other harnesses",
};
const problems = [];
for (const [key, row] of Object.entries(status)) {
  const line = doc.split("\n").find((l) => l.startsWith(`| ${names[key]} |`));
  if (!line) { problems.push(`${key}: no row in docs/roadmap.md`); continue; }
  if (!line.toLowerCase().includes(row.verdict)) problems.push(`${key}: doc does not say ${row.verdict}`);
  if (row.receipt && !line.includes(row.receipt)) problems.push(`${key}: doc does not cite ${row.receipt}`);
  if (row.receipt) { try { readFileSync(row.receipt.replace(/\/$/, "") + "/" + (key === "native-harness" ? "verdict.json" : key === "mutant-judge" ? "verdict.json" : key === "resume" ? "resume.json" : key === "edge-workspaces" ? "edge.json" : "score.json")); } catch { problems.push(`${key}: receipt file missing`); } }
}
if (problems.length) { console.error(problems.join("\n")); process.exit(1); }
console.log(`roadmap ok: ${Object.keys(status).length} rows`);
