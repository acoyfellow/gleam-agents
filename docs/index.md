# gleam-agents

Run N coding agents at once. Each agent has its own goal, its own shape (model, harness, tools, budget) and its own file scope. Real benchmarks grade the result. The core is Gleam on the BEAM: one process per agent, so a crash or a runaway loop stays in one place.

## Case study: Bug Hunter

[Bug Hunter](/bughunt) is a 111-bug benchmark for code reviewers. The fleet run scored 33 to 35 of 103 deduplicated bugs, more than double local gsa, at about one dollar per MR.

## The problem

An eval of coding agents needs three things that most harnesses mix together:

1. **Who the agent is.** Model, tools, budget, harness.
2. **What it may touch.** Files it can write, and nothing else.
3. **Who grades it.** A grader the agent can not see or change.

When these are tangled, you can not tell whether a score came from the model, the harness or a leaky grader.

## The promise

One plan file names N seats. Each seat is shape × goal × scope × grader. `fleet` runs every seat at once, writes one receipt per seat, and a separate script recomputes the score from those receipts.

## How it works

```text
plan.json ──► fleet (Gleam, one BEAM process per seat)
                │  copy seed ► workspace
                │  agent loop: model ◄► tools (list, read, write, edit, grep, run_tests, done)
                │      write/edit pass through the scope guard
                │  visible tests ► grader command (hidden tests, cf-build-bench gate, …)
                ▼
          items/<seat>.json ──► score.mjs (recompute) ──► report ──► /reports
```

- **Shapes** live in `catalog/*.json`. See [Catalog](/docs/catalog).
- **Plans** live in `evals/*/plan.json`. See [Plans](/docs/plans).
- **Scope** is a list of writable paths. Reads may go anywhere inside the workspace. Writes outside the list are refused and counted. See [Scope](/docs/scope).
- **Graders** are shell commands. The agent never sees them. See [Graders](/docs/graders).

## Quick start

```sh
git clone https://github.com/acoyfellow/gleam-agents && cd gleam-agents
export ANTHROPIC_API_KEY=…
scripts/smoke.sh evals/smoke/plan.json
```

To publish a report here, install the Pi extension and sign in. See [Pi extension](/docs/pi).

## What this site is

This site is **docs and published reports only**. It runs no agents and calls no models. You sign in with your Cloudflare account so a report shows who published it. Nothing here bills your account.

## What it does not do

- It is not a sandbox. A seat runs shell commands (tests, graders) on the machine that runs `fleet`. Run it where you accept that.
- One smoke run is an anecdote. The reports say how many runs they cover.
- Two harnesses: `pi` and `native`. Every row of the [Roadmap](/docs/roadmap) has one smoke run, not a full eval.
