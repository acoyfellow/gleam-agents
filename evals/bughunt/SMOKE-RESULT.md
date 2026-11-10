# Bug-hunt smoke via gleam-agents

Date: 2026-11-09. Plan: `evals/bughunt/plan.json`, shape `catalog/opus-pi.json`
(model claude-opus-5-5 via opencode gateway). Each seat got one MR's
diff (`seeds/<iid>/mr.diff`), wrote `review.md`, and was graded by
`grade_one.py`, which runs the review-lab judge prompt on that MR's known
bugs. A seat "passes" when it catches >= 1 bug as ALARM.

Result: 1/3 seats passed, $3.21 total, 233s wall for 3 seats in parallel.

| Seat (MR) | Turns | Cost | Result |
|---|---|---|---|
| rev-867 (cloudflare-agent !867) | 4 | $0.38 | 2/2 ALARM, pass |
| rev-803 (!803) | 6 | $0.82 | 0/1 ALARM |
| rev-754 (!754) | 9 | $2.02 | 0/2 ALARM |

Total: 2/5 ALARM. Compare on the same 3 MRs: gsa_claude posted 0/5,
local gsa replay 2/5 (both on !754, gleam's were on !867).

Notable: rev-867's review did find the known bug in its own words:
"One bad entry, or pageTools: null, removes the whole block". rev-754's
review found real issues (rolling-window cost, $0.00 for unknown IDs) but
not the seeded timeout/stale-spend bugs.

Friction: fleet requires ANTHROPIC_API_KEY or LLM_URL+LLM_TOKEN_FILE at
boot even for pi seats. Worked around with a dummy LLM_URL; pi seats
never call it. Worth fixing upstream (native-only check).

Verdict: the inverted fleet works. 53 MRs can run as 53 parallel seats,
each graded by a hidden command, with receipts recomputed by score.mjs.

## v2: checklist prompt + trimmed seeds + caps

Changes vs v1: failure-mode checklist + second-look rule in prompt,
mr.md (title+description) added to seeds, test files stripped from diffs
(!754 152KB -> 117KB, !803 74KB -> 48KB), caps 12 turns / 10 min.

Result: 2/3 seats passed, 3/5 ALARM (was 2/5), $1.83 (was $3.21),
122s wall (was 233s).

| Seat | Turns | Cost | Result |
|---|---|---|---|
| rev-754 | 5 | $0.96 | 0/2 ALARM (still missed) |
| rev-803 | 4 | $0.49 | 1/1 ALARM (was 0/1) |
| rev-867 | 4 | $0.38 | 2/2 ALARM |

!803's review now says it outright: "One model, no fallback and no
retry: any transient Workers AI error becomes a user-visible failure".

!754 still missed both seeded bugs (no timeout on spend fetches,
loaded=!!data showing stale cost after error), even though it found
timeout-adjacent issues (gateway timeout logging, fallback query
latency). The checklist moved the needle on 1 of 2 misses and halved
cost and time.
