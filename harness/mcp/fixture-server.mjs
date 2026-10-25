import { appendFileSync } from "node:fs";
import { createInterface } from "node:readline";

const word = process.env.FIXTURE_WORD ?? "tangerine-41";
const log = process.env.FIXTURE_LOG;

const reply = (id, result) => process.stdout.write(`${JSON.stringify({ jsonrpc: "2.0", id, result })}\n`);
const fail = (id, message) => process.stdout.write(`${JSON.stringify({ jsonrpc: "2.0", id, error: { code: -32601, message } })}\n`);

const tools = [
  {
    name: "secret_word",
    description: "Returns the secret word for this seat. Call it once.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
];

createInterface({ input: process.stdin }).on("line", (line) => {
  let msg;
  try { msg = JSON.parse(line); } catch { return; }
  if (msg.id === undefined) return;
  if (msg.method === "initialize") return reply(msg.id, { protocolVersion: msg.params?.protocolVersion ?? "2025-06-18", capabilities: { tools: {} }, serverInfo: { name: "fleet-fixture", version: "0.0.1" } });
  if (msg.method === "tools/list") return reply(msg.id, { tools });
  if (msg.method === "tools/call" && msg.params?.name === "secret_word") {
    if (log) appendFileSync(log, `${JSON.stringify({ at: Date.now(), tool: "secret_word" })}\n`);
    return reply(msg.id, { content: [{ type: "text", text: word }] });
  }
  if (msg.method === "ping") return reply(msg.id, {});
  return fail(msg.id, `unknown method ${msg.method}`);
});
