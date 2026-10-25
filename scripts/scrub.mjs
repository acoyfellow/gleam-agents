import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

const dest = process.argv[2];
const home = process.env.HOME;
const rules = [
  [new RegExp(`${home}/cloudflare/gleam-agents`, "g"), "$REPO"],
  [new RegExp(`${home}/cloudflare/cf-build-bench`, "g"), "$CF_BUILD_BENCH"],
  [new RegExp(`${home}/cloudflare/public/ply`, "g"), "$PLY_DIR"],
  [new RegExp(`${home}/cloudflare/mutant`, "g"), "$MUTANT_DIR"],
  [new RegExp(`${home}/cloudflare/booth/\\.real/llm\\.env`, "g"), "$LLM_TOKEN_FILE"],
  [new RegExp(home, "g"), "~"],
  [/<ACCOUNT_ID>/g, "<ACCOUNT_ID>"],
  [/<ACCOUNT_ID>/g, "<ACCOUNT_ID>"],
  [/<ZONE_ID>/g, "<ZONE_ID>"],
  [/https:\/\/gateway\.opencode\.cloudflare\.dev\/anthropic\/v1\/messages/g, "$LLM_URL"],
  [/jcoeyman@cloudflare\.com/g, "<email>"],
];
const publicShape = (text) => {
  const shape = JSON.parse(text);
  if (shape.pi) shape.pi = { provider: "anthropic", extensions: (shape.pi.extensions ?? []).filter((e) => !e.includes("opencode-cloudflare")) };
  return `${JSON.stringify(shape, null, 1)}\n`;
};
const forbidden = [/opencode\.cloudflare\.dev/, /\/Users\/[a-z]/, /art_v2_[a-z]_[0-9a-f]{20}/, /ga_[0-9a-f]{64}/, /cfdata\.org/, /<\/?jcoeyman/];

const walk = (dir, out = []) => {
  for (const name of readdirSync(dir)) {
    if (name === ".git" || name === "node_modules") continue;
    const p = join(dir, name);
    statSync(p).isDirectory() ? walk(p, out) : out.push(p);
  }
  return out;
};

const leaks = [];
for (const file of walk(dest)) {
  let text;
  try { text = readFileSync(file, "utf8"); } catch { continue; }
  if (text.includes("\u0000")) continue;
  let next = text;
  for (const [re, to] of rules) next = next.replace(re, to);
  const rel = relative(dest, file);
  if (/^catalog\/.*\.json$/.test(rel) || /^proof\/(edge|resume)-1\/shape\.json$/.test(rel)) next = publicShape(next);
  if (/\.pi\/seat-shape\.json$/.test(rel)) next = publicShape(next);
  if (next !== text) writeFileSync(file, next);
  for (const re of forbidden) if (re.test(next)) leaks.push(`${rel}: ${re}`);
}
if (leaks.length) {
  console.error(`scrub found ${leaks.length} leaks:\n${leaks.slice(0, 30).join("\n")}`);
  process.exit(1);
}
console.log(`scrubbed ${dest}: no leaks`);
