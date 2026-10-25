import { appendFileSync } from "node:fs";
import { isAbsolute, relative, resolve } from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const root = resolve(process.env.FLEET_WORKSPACE ?? process.cwd());
const writable = (process.env.FLEET_WRITABLE ?? "").split(",").map((w) => w.trim()).filter(Boolean);
const ledger = process.env.FLEET_LEDGER;

const inside = (path: string): string | null => {
  const rel = relative(root, resolve(root, path));
  return rel === "" || rel.startsWith("..") || isAbsolute(rel) ? null : rel;
};

export const allowsWrite = (path: string): boolean => {
  const rel = inside(path);
  if (rel === null) return false;
  return writable.some((w) => (w.endsWith("/") ? rel.startsWith(w) : rel === w));
};

const record = (entry: Record<string, unknown>) => {
  if (ledger) appendFileSync(ledger, `${JSON.stringify({ at: Date.now(), ...entry })}\n`);
};

export default function scopeGuard(pi: ExtensionAPI) {
  pi.on("tool_call", async (event) => {
    const input = (event.input ?? {}) as { path?: unknown };
    record({ kind: "tool", tool: event.toolName });
    if (event.toolName !== "write" && event.toolName !== "edit") return;
    const path = typeof input.path === "string" ? input.path : "";
    if (allowsWrite(path)) return;
    record({ kind: "denied", tool: event.toolName, path });
    return { block: true, reason: `scope: ${path || "(no path)"} is not writable. Writable: ${writable.join(", ")}` };
  });
}
