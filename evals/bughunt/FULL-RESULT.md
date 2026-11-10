# Bug-hunt full run: 53 MRs via gleam-agents

Date: 2026-11-09. Plan: `evals/bughunt/full/plan-b{1..4}.json`, 53 seats in
4 batches, shape `catalog/opus-pi.json` (claude-opus-5-5 via
opencode gateway). Each seat: MR title+description (`mr.md`),
test-stripped diff (`mr.diff`), checklist prompt with failure-mode
checklist and second-look rule, caps 12 turns / 10 min. Grading: one
`judge.py` pass over `bughunt-full-reviews.json` (111 bugs, hash-cached).

Result: **35/111 ALARM**, 5 LOW, 71 NO. 27 of 53 MRs caught at least one
bug. 3.51 serious warnings/MR. Total $50.84, 14 min of fleet wall time
(~$0.96 per review).

Compare (ALARM of 111):
- gsa_claude as posted: 6
- gsa run locally (4 runs): 15, 16, 16, 18
- m1 merge pipeline, fully fresh: 25
- **bughunt-full (this run): 35**

Cheapest strong result so far. The fleet receipts recompute agrees for
all 4 batches.
