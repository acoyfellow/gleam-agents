import { spawn } from "node:child_process";
import { createWriteStream, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const [workspace, shapeFile, promptFile, receiptFile] = process.argv.slice(2);
if (!receiptFile) {
  console.error("usage: run-seat.mjs <workspace> <shape.json> <prompt.md> <receipt.json>");
  process.exit(2);
}

const here = dirname(fileURLToPath(import.meta.url));
const shape = JSON.parse(readFileSync(shapeFile, "utf8"));
const pi = shape.pi ?? {};
const seatDir = resolve(workspace, "..", `${shape.seat_id ?? "seat"}.pi`);
mkdirSync(seatDir, { recursive: true });
const ledger = join(seatDir, "ledger.jsonl");
const events = join(seatDir, "events.jsonl");
const sessionDir = join(seatDir, "session");
const sessionId = process.env.FLEET_SESSION_ID ?? `seat-${shape.seat_id ?? "x"}`;
const resuming = existsSync(sessionDir) && process.env.FLEET_RESUME === "1";

const mcpLog = join(seatDir, "mcp-calls.jsonl");
const expand = (value) => JSON.parse(JSON.stringify(value).replace(/\$\{(\w+)\}/g, (_, k) => (k === "FLEET_MCP_LOG" ? mcpLog : process.env[k] ?? "")));

const agentDir = mkdtempSync(join(tmpdir(), "fleet-pi-agent-"));
const mcpConfig = (servers) => {
  const dir = agentDir;
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "mcp.json"), JSON.stringify({ mcpServers: expand(servers) }, null, 1));
  return dir;
};

const args = [
  "-p", "--mode", "json",
  "--no-skills",
  ...(shape.mcp ? [] : ["--no-mcp"]),
  ...(pi.extensions ?? []).flatMap((e) => ["-e", e.replace(/^~/, process.env.HOME)]),
  "-e", join(here, "scope-guard.ts"),
  "--provider", pi.provider ?? "anthropic",
  "--model", shape.model,
  ...(shape.thinking ? ["--thinking", shape.thinking] : []),
  ...(shape.tools ? ["--tools", [...shape.tools, ...Object.keys(shape.mcp ?? {}).map((n) => `mcp__${n}__*`)].join(",")] : []),
  "--session-dir", sessionDir,
  "--session-id", sessionId,
  resuming ? "Continue the task from where you stopped. Finish it." : readFileSync(promptFile, "utf8"),
];

const env = {
  ...process.env,
  FLEET_WORKSPACE: workspace,
  FLEET_WRITABLE: (shape.writable ?? []).join(","),
  FLEET_LEDGER: ledger,
  PI_CODING_AGENT_DIR: mcpAgentDir(shape.mcp ?? {}),
};

function mcpAgentDir(servers) {
  const dir = mcpConfig(servers);
  const home = join(process.env.HOME, ".pi", "agent");
  for (const f of ["auth.json", "models.json", "settings.json"]) {
    if (existsSync(join(home, f)) && !existsSync(join(dir, f))) writeFileSync(join(dir, f), f === "settings.json" ? JSON.stringify({ packages: [], extensions: [] }) : readFileSync(join(home, f)), { mode: 0o600 });
  }
  return dir;
}

for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => { rmSync(agentDir, { recursive: true, force: true }); child.kill(sig); process.exit(130); });
const started = Date.now();
const out = createWriteStream(events, { flags: resuming ? "a" : "w" });
const child = spawn("pi", args, { cwd: workspace, env, stdio: ["ignore", "pipe", "pipe"] });
const budgetMs = (shape.max_minutes ?? 15) * 60_000;
const killer = setTimeout(() => child.kill("SIGTERM"), budgetMs);
writeFileSync(join(seatDir, "pid"), String(child.pid));

let buf = "";
let stderr = "";
const tally = { turns: 0, tokens_in: 0, tokens_out: 0, usd: 0, stop: null, tool_calls: 0, mcp_calls: 0, last_text: "" };
child.stdout.on("data", (chunk) => {
  out.write(chunk);
  buf += chunk;
  let nl;
  while ((nl = buf.indexOf("\n")) >= 0) {
    const line = buf.slice(0, nl);
    buf = buf.slice(nl + 1);
    let e;
    try { e = JSON.parse(line); } catch { continue; }
    if (e.type === "message_end" && e.message?.role === "assistant") {
      const u = e.message.usage ?? {};
      tally.turns += 1;
      tally.tokens_in += (u.input ?? 0) + (u.cacheRead ?? 0) + (u.cacheWrite ?? 0);
      tally.tokens_out += u.output ?? 0;
      tally.usd += u.cost?.total ?? 0;
      tally.stop = e.message.stopReason ?? tally.stop;
      const text = (e.message.content ?? []).filter((c) => c.type === "text").map((c) => c.text).join("");
      if (text) tally.last_text = text;
    }
    if (e.type === "tool_execution_start") {
      tally.tool_calls += 1;
      if (String(e.toolName ?? "").startsWith("mcp__") || String(e.toolName ?? "").includes("__")) tally.mcp_calls += 1;
    }
  }
});
child.stderr.on("data", (c) => (stderr += c));

child.on("close", (code, signal) => {
  clearTimeout(killer);
  out.end();
  rmSync(agentDir, { recursive: true, force: true });
  const denials = existsSync(ledger) ? readFileSync(ledger, "utf8").split("\n").filter((l) => l.includes('"denied"')).length : 0;
  const outcome = signal ? "killed" : code !== 0 ? "harness_error" : tally.stop === "stop" ? "done" : tally.stop === "length" ? "ran_out_of_tokens" : "stopped_talking";
  const receipt = {
    harness: "pi",
    outcome,
    note: (outcome === "harness_error" ? stderr.slice(-300) : tally.last_text.slice(0, 300)),
    turns: tally.turns,
    tool_calls: tally.tool_calls,
    mcp_calls: tally.mcp_calls,
    scope_denials: denials,
    tests_run: existsSync(ledger) ? readFileSync(ledger, "utf8").split("\n").filter((l) => l.includes('"tool":"bash"')).length : 0,
    tokens_in: tally.tokens_in,
    tokens_out: tally.tokens_out,
    usd: Math.round(tally.usd * 10000) / 10000,
    ms: Date.now() - started,
    session_id: sessionId,
    resumed: resuming,
  };
  writeFileSync(receiptFile, JSON.stringify(receipt));
  process.exit(0);
});
