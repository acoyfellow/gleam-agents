# Roadmap

Each row is an experiment with a claim that can fail. Each has one smoke run (1×) and a receipt in `proof/`. `status.json` holds the same table.

| Row | Claim | Verdict | Receipt |
|---|---|---|---|
| Native harness | N seats, own goals, own scopes, graded by real benchmarks | proven: 14/17 on bench/hard vs Elixir baseline 45/51 | `proof/eval/` |
| cf-build-bench grader | The bench gate grades a seat's output unchanged | proven on `kv-crud` (1/1) | `proof/smoke-3/` |
| Scope guard (native) | Writes outside the list are refused and counted | proven: 2 refusals | `proof/scope-1/` |
| Pi harness | A seat runs `pi` in its workspace and writes the same receipt | proven: cart-merge passed hidden tests | `proof/pi-1/` |
| Scope guard (Pi) | The same write list holds inside Pi, through a `tool_call` block | proven: 2 refusals, 1 allowed write | `proof/pi-scope-1/` |
| MCP in shapes | A shape lists MCP servers; the agent calls one; the receipt counts it | proven: 1 MCP call, server logged it, word written | `proof/mcp-1/` |
| Resume | A Pi seat killed mid-run resumes the same session and finishes | proven: killed after 3 turns, one session file, hidden tests pass | `proof/resume-1/` |
| Edge workspaces | A seat works on an Artifacts branch through ply, with no local files and no shell | proven: 1 commit (574 B push), fast-forward merge, fsck ok, tests pass | `proof/edge-1/` |
| Mutant judge | Mutant score < 0.5 flags the seats whose visible tests pass but hidden tests fail | **disproven**: 0 of 3 wrong ships flagged; lowest wrong-ship score 0.667 | `proof/mutant-1/` |
| Other harnesses | opencode, claude-code | not planned: Pi is the product harness, native is the control | — |

## What the mutant result means

In swarm-desk Batch A, low mutant scores on the *reference* code predicted wrong ships (8/9). On the agents' *own* code in this run, all three wrong ships scored 0.667 to 0.882. The agents wrote tests that kill most mutants and still missed the hidden cases. Mutant score measures how well the tests pin the code that exists. It does not find a requirement the agent never coded. It is not used as a judge.

## Not verified

- Each row is one run. The bands are wide.
- The Pi harness ran one bench/hard task, not all 17.
- Resume was tested by killing `pi`, not by killing the BEAM node.
- Edge workspaces ran one seat, not many writers on one repo.
