import { spawn } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";

const BASE = (process.env.GLEAM_AGENTS_URL ?? "https://gleam-agents.coey.dev").replace(/\/$/u, "");
const TOKEN_FILE = process.env.GLEAM_AGENTS_TOKEN_FILE ?? join(homedir(), ".config", "gleam-agents", "token");
const REPO = process.env.GLEAM_AGENTS_REPO ?? resolve(dirname(fileURLToPath(import.meta.url)), "..");

type Score = { plan: string; baseline: string; seats: number; passed: number; usd: number; wall_ms: number; agrees_with_run_json: boolean; per_seat: unknown[] };

const readToken = (): string | null => (existsSync(TOKEN_FILE) ? readFileSync(TOKEN_FILE, "utf8").trim() || null : null);

const saveToken = (token: string) => {
	mkdirSync(dirname(TOKEN_FILE), { recursive: true, mode: 0o700 });
	writeFileSync(TOKEN_FILE, token, { mode: 0o600 });
	chmodSync(TOKEN_FILE, 0o600);
};

const api = async (path: string, init: RequestInit = {}): Promise<Response> => {
	const headers = new Headers(init.headers);
	const token = readToken();
	if (token) headers.set("authorization", `Bearer ${token}`);
	return fetch(`${BASE}${path}`, { ...init, headers });
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const login = async (say: (text: string) => void, label = "pi"): Promise<string> => {
	const start = (await (await fetch(`${BASE}/cli/start`, { method: "POST" })).json()) as { id: string; code: string; approve: string; expiresInSec: number };
	say(`Open ${start.approve}\nCheck that the page shows the code ${start.code}, then approve.`);
	const until = Date.now() + start.expiresInSec * 1000;
	while (Date.now() < until) {
		await sleep(2000);
		const r = await fetch(`${BASE}/cli/finish`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: start.id, label }) });
		if (r.status === 200) {
			const { token } = (await r.json()) as { token: string };
			saveToken(token);
			return whoami();
		}
	}
	throw new Error("login timed out; run /gleam-agents login again");
};

export const whoami = async (): Promise<string> => {
	const r = await api("/oauth/me");
	if (r.status === 401) return `not signed in to ${BASE}. Run /gleam-agents login`;
	const me = (await r.json()) as { email: string | null; account: string | null; via: string };
	return `signed in to ${BASE} as ${me.email ?? "?"} (account ${me.account ?? "?"}, via ${me.via})`;
};

const run = (plan: string, out: string): Promise<{ code: number; output: string }> =>
	new Promise((done) => {
		const child = spawn("bash", ["scripts/smoke.sh", plan, out], { cwd: REPO, env: process.env });
		let output = "";
		child.stdout.on("data", (b) => (output += b));
		child.stderr.on("data", (b) => (output += b));
		child.on("close", (code) => done({ code: code ?? 1, output }));
	});

const readScore = (out: string): Score => JSON.parse(readFileSync(resolve(REPO, out, "score.json"), "utf8")) as Score;

export const publish = async (out: string, title: string, notes: string): Promise<{ id: string; url: string }> => {
	if (!readToken()) throw new Error("not signed in. Run /gleam-agents login");
	const summary = readScore(out);
	if (!summary.agrees_with_run_json) throw new Error("score.json does not agree with run.json; refusing to publish");
	const r = await api("/api/reports", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ title, summary, markdown: notes }) });
	const body = (await r.json()) as { id?: string; url?: string; error?: string };
	if (r.status !== 201 || !body.id || !body.url) throw new Error(`publish failed ${r.status}: ${body.error ?? ""}`);
	return { id: body.id, url: body.url };
};

const text = (value: unknown) => ({ content: [{ type: "text" as const, text: typeof value === "string" ? value : JSON.stringify(value, null, 2) }], details: value });

export default function gleamAgents(pi: ExtensionAPI) {
	pi.registerCommand("gleam-agents", {
		description: "gleam-agents: login | whoami | logout",
		handler: async (args, ctx) => {
			const verb = (args ?? "").trim() || "whoami";
			const say = (t: string) => ctx.ui.notify(t, "info");
			try {
				if (verb === "login") say(await login(say));
				else if (verb === "logout") {
					writeFileSync(TOKEN_FILE, "", { mode: 0o600 });
					say("token removed. Sign out on the site to revoke every token.");
				} else say(await whoami());
			} catch (cause) {
				ctx.ui.notify(String(cause), "error");
			}
		},
	});

	pi.registerTool({
		name: "gleam_agents_run",
		label: "gleam-agents run",
		description: "Run a gleam-agents plan: N coding agents at once, each with its own shape, goal and file scope, graded by hidden tests or the cf-build-bench gate. Returns the score recomputed from per-seat receipts. Runs on this machine.",
		parameters: Type.Object({
			plan: Type.String({ description: "plan path relative to the gleam-agents repo, e.g. evals/smoke/plan.json" }),
			out: Type.Optional(Type.String({ description: "output dir relative to the repo (default proof/run-<time>)" })),
		}),
		execute: async (_id, input) => {
			const out = input.out ?? `proof/run-${new Date().toISOString().replace(/[:.]/gu, "-")}`;
			const result = await run(input.plan, out);
			if (result.code !== 0) throw new Error(`run failed (exit ${result.code}):\n${result.output.slice(-2000)}`);
			return text({ out, score: readScore(out) });
		},
	});

	pi.registerTool({
		name: "gleam_agents_publish",
		label: "gleam-agents publish",
		description: `Publish a finished run's score.json plus markdown notes as a report on ${BASE}/reports. Needs /gleam-agents login first. Refuses if the recomputed score disagrees with run.json.`,
		parameters: Type.Object({
			out: Type.String({ description: "run output dir relative to the repo" }),
			title: Type.String(),
			notes: Type.String({ description: "markdown: what ran, against which baseline, what it shows, what is not verified" }),
		}),
		execute: async (_id, input) => text(await publish(input.out, input.title, input.notes)),
	});

	pi.registerTool({
		name: "gleam_agents_reports",
		label: "gleam-agents reports",
		description: `List published reports on ${BASE}.`,
		parameters: Type.Object({}),
		execute: async () => text(await (await api("/api/reports")).json()),
	});
}
