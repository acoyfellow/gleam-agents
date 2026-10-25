# Claim: the Gleam fleet matches the Elixir swarm on bench/hard

- **Metric:** hidden-test pass rate on bench/hard, 17 tasks.
- **Ours:** gleam-agents `native` harness, shape `haiku45-native`, 1 run per task (smoke budget: no repeats).
- **Baseline:** swarm-desk Elixir native loop, same model (claude-haiku-4-5), same tasks, same hidden tests: 45/51 = 0.882 (`evals/baseline-hard-final.json`, 3 repeats).
- **Threshold:** proven if ours >= 0.882 - 0.15 = 0.732 (at least 13 of 17). Disproven if lower after 2 fair fix attempts on the harness (not on the tasks).
- **Noise:** one run of 17 has a wide band. This claim is a parity smoke check, not a ranking.
- **Proof:** `node scripts/score.mjs proof/eval && node scripts/verdict.mjs proof/eval`.
