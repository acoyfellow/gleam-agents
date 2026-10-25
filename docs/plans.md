# Plans: N seats, N goals

A plan is one JSON file. Each seat is one agent.

```json
{
  "name": "smoke-1x",
  "baseline": "what this run is compared with",
  "seats": [
    {
      "id": "s1-sonnet-catalog",
      "shape": "sonnet5-native",
      "goal": "catalog-search",
      "prompt_file": "prompts/catalog-search.md",
      "seed": "../../bench/hard/seed",
      "writable": ["src/catalog.ts", "test/catalog.test.ts"],
      "test_command": "node --test 2>&1 | tail -30",
      "grade_command": "…hidden tests…"
    }
  ]
}
```

| Field | Meaning |
|---|---|
| `shape` | A file name in `catalog/` |
| `goal` | A label for the report |
| `prompt_file` | The task text, relative to the plan |
| `seed` | A folder copied into the seat's workspace, relative to the plan |
| `writable` | Exact files, or folders ending in `/` |
| `test_command` | What `run_tests` runs. The agent sees its output |
| `grade_command` | Runs after the agent stops. Exit 0 is a pass. The agent never sees it |

Every seat starts at the same moment. Seats share nothing but the machine.

## Run

```sh
scripts/smoke.sh evals/smoke/plan.json proof/my-run
```

Output:

```text
proof/my-run/run.json              the run summary fleet wrote
proof/my-run/items/<seat>.json     one receipt per seat
proof/my-run/items/<seat>.grade.txt  grader output
proof/my-run/score.json            recomputed from items/, must agree with run.json
```

`score.mjs` exits 1 if its numbers do not match `run.json`. The agent's own "done" is never the score.
