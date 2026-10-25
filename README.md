# gleam-agents

Run N coding agents at once. Each agent has its own goal, its own shape (model, harness, tools, MCP servers) and its own file scope. Real benchmarks grade the result. The core is Gleam on the BEAM: one process per agent.

Docs: **https://gleam-agents.coey.dev** · Reports: https://gleam-agents.coey.dev/reports

## The problem

An eval of coding agents mixes three things: who the agent is, what it may touch, and who grades it. When they are tangled, you cannot tell whether a score came from the model, the harness or a leaky grader.

## The promise

One plan file names N seats. Each seat is shape × goal × scope × grader. `fleet` runs every seat at once, writes one receipt per seat, and a separate script recomputes the score from those receipts.

## Quick start

```sh
git clone https://github.com/acoyfellow/gleam-agents && cd gleam-agents
export ANTHROPIC_API_KEY=…
scripts/smoke.sh evals/smoke/plan-scope.json proof/my-first-run
```

Needs Gleam ≥ 1.19, Erlang/OTP ≥ 28, Node ≥ 22. Pi shapes also need `pi` on your PATH.

## Pi extension

```sh
pi install git:github.com/acoyfellow/gleam-agents
```

In Pi: `/gleam-agents login`, then the tools `gleam_agents_run`, `gleam_agents_publish`, `gleam_agents_reports`. See [docs/pi.md](docs/pi.md).

## Proof

Every roadmap row has one smoke run and a receipt in `proof/`. `bash proof/gate.sh` re-checks all of them.

| Row | Verdict |
|---|---|
| Native harness, 17 bench/hard tasks | proven: 14/17 vs Elixir baseline 45/51 |
| Pi harness | proven: 1 task, hidden tests pass |
| Scope guard (native and Pi) | proven: writes outside the list refused |
| MCP servers in shapes | proven: 1 MCP call, logged by the server |
| Resume a killed Pi seat | proven: same session, finished, hidden tests pass |
| Edge workspace (Artifacts + ply, no local files) | proven: 1 commit, merged, fsck ok |
| Mutant score as a judge | **disproven**: 0 of 3 wrong ships flagged |

Full table: [docs/roadmap.md](docs/roadmap.md).

## Limits

- Not a sandbox. Test and grade commands run as your user.
- Every row is one run. The bands are wide.
- Harnesses: `pi` (product) and `native` (control). Others are not planned.

## License

MIT
