import { appendFileSync } from "node:fs";
import { join } from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";

const plyDir = process.env.PLY_DIR ?? join(process.env.HOME ?? "", "cloudflare/public/ply");
const remote = process.env.FLEET_REMOTE ?? "";
const token = process.env.FLEET_REMOTE_TOKEN ?? "";
const branch = process.env.FLEET_BRANCH ?? "refs/heads/seat";
const base = process.env.FLEET_BASE ?? "refs/heads/main";
const writable = (process.env.FLEET_WRITABLE ?? "").split(",").filter(Boolean);
const ledger = process.env.FLEET_LEDGER;
const author = { name: "gleam-agents seat", email: "seat@gleam-agents.coey.dev" };

type Ply = {
  editFile: (url: string, spec: Record<string, unknown>, opts: Record<string, unknown>) => Promise<{ newCommit?: string; pushBytes?: number; noop?: boolean }>;
  readFile: (url: string, spec: Record<string, unknown>, opts: Record<string, unknown>) => Promise<{ stream: ReadableStream<Uint8Array> | AsyncIterable<Uint8Array> }>;
  listTree: (url: string, spec: Record<string, unknown>, opts: Record<string, unknown>) => Promise<{ entries: { path?: string; name: string; type?: string; mode?: string }[] }>;
};

const ply = (await import(join(plyDir, "src/index.js"))) as Ply & { Tracer: new (o: unknown) => unknown; arrayExporter: (a: unknown[]) => unknown };
const spans: unknown[] = [];
const tracer = new ply.Tracer({ exporter: ply.arrayExporter(spans) });
const opts = { auth: { bearer: token }, tracer };
let branchExists = false;

const record = (entry: Record<string, unknown>) => {
  if (ledger) appendFileSync(ledger, `${JSON.stringify({ at: Date.now(), ...entry })}\n`);
};

const allowed = (path: string) => !path.includes("..") && !path.startsWith("/") && writable.some((w) => (w.endsWith("/") ? path.startsWith(w) : path === w));

const decode = async (r: { stream: ReadableStream<Uint8Array> | AsyncIterable<Uint8Array> }) => {
  const parts: Uint8Array[] = [];
  for await (const chunk of r.stream as AsyncIterable<Uint8Array>) parts.push(chunk);
  return Buffer.concat(parts).toString("utf8");
};

const readRef = () => (branchExists ? branch : base);
const ok = (text: string) => ({ content: [{ type: "text" as const, text }], details: {} });

const walk = async (path: string, out: string[]) => {
  const { entries } = await ply.listTree(remote, { ref: readRef(), path }, opts);
  for (const e of entries) {
    const full = path ? `${path}/${e.name}` : e.name;
    if (e.type === "tree" || e.mode === "040000") await walk(full, out);
    else out.push(full);
  }
};

export default function plyWorkspace(pi: ExtensionAPI) {
  pi.registerTool({
    name: "repo_list",
    label: "List files",
    description: "List every file in the repository (the seat's branch, or main before the first edit).",
    parameters: Type.Object({}),
    execute: async () => {
      record({ kind: "tool", tool: "repo_list" });
      const files: string[] = [];
      await walk("", files);
      return ok(files.join("\n"));
    },
  });

  pi.registerTool({
    name: "repo_read",
    label: "Read file",
    description: "Read one file from the repository.",
    parameters: Type.Object({ path: Type.String() }),
    execute: async (_id, { path }) => {
      record({ kind: "tool", tool: "repo_read", path });
      return ok(await decode(await ply.readFile(remote, { ref: readRef(), path }, opts)));
    },
  });

  pi.registerTool({
    name: "repo_edit",
    label: "Edit file",
    description: "Replace one exact snippet in a file. `find` must occur exactly once. Each edit is one commit on your branch.",
    parameters: Type.Object({ path: Type.String(), find: Type.String(), replace: Type.String() }),
    execute: async (_id, { path, find, replace }) => {
      if (!allowed(path)) {
        record({ kind: "denied", tool: "repo_edit", path });
        throw new Error(`scope: ${path} is not writable. Writable: ${writable.join(", ")}`);
      }
      const spec = branchExists ? { ref: branch, path, find, replace, author, message: `edit ${path}` } : { ref: branch, base, path, find, replace, author, message: `edit ${path}` };
      const r = await ply.editFile(remote, spec, opts);
      branchExists = true;
      record({ kind: "tool", tool: "repo_edit", path, commit: r.newCommit, pushBytes: r.pushBytes });
      return ok(`committed ${r.newCommit ?? "(noop)"} on ${branch}`);
    },
  });
}
