# Bug Hunter: a benchmark for code reviewers

We set out to beat gsa_claude, and prove it. The test: 111 real bugs
from 53 merged merge requests. A reviewer scores when it flags the bug
as serious, minor, or not at all.

## Result

**33 to 35 of 103 deduplicated bugs.** Two independent judges agree on
104 of 111 labels. Local gsa on the same MRs scored 15 to 18. Warnings
per MR: 3.5, against gsa at 3.9. Cost: about one dollar per MR.
Time: 14 minutes for 53 MRs. 102 of 103 bugs were reachable from the
diff alone.

## Scoreboard (of 103 deduplicated bugs)

| Reviewer | Caught | $/MR |
|---|---|---|
| gsa as posted in GitLab (older model) | 6 of 111 | — |
| gsa run locally, 4 runs | 15 to 18 | ~$1 |
| 4 reviews merged into 1, fully fresh | 25 | ~$5 |
| Fleet run: 1 Opus per MR, failure checklist | **33 to 35** | **$0.96** |
| Haiku 5-5 (newest small Claude) | 22 of 111 | $0.55 |

## Why the fleet wins

The run matters more than the model. gsa reads the diff. It never
runs the code. The fleet seats get a failure-mode checklist: timeout,
fallback, error display, stale data, one bad item killing the batch.
That checklist caught a bug the plain prompt missed and halved cost
and time.

One good reviewer beats four merged ones. The merge costs five times
more and catches less.

## Scale

200 placebo seats ran in 43 seconds for $1.12. Haiku at 50 parallel
ran 25 seats per minute at $0.23 per seat. Opus at 50 parallel runs
about 1 seat per minute on a personal gateway login. The fleet
mechanics scale. The model gateway is the ceiling.

## Caveats

48 of 53 MRs come from one project. One MR holds 33 bugs, 8 of them
duplicates; deduplicated, the fleet still scores 35. Prompts were
tuned on this bench, so results are not held out. A red team audited
the dataset before publish.

## Links

- Benchmark and ledgers: jcoeyman/bug-hunter (internal GitLab)
- Fleet plans and results: `evals/bughunt/` in this repo
- Reports: [/reports](/reports)
