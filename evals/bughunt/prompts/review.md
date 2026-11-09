# Review this merge request

Read `mr.md` (the MR title and description) and `mr.diff` in the workspace
root. The diff is the full diff of one merged merge request, with test
files removed. Review it for real bugs: behaviour that breaks for a user,
operator or CI job.

Rules:
1. Only report problems you can point to in the diff. Quote the file and
   line for each finding.
2. Mark each finding [BLOCKING] (must not merge), [WARNING] (real problem,
   should fix), or [SUGGESTION] (minor). At most 4 BLOCKING/WARNING.
3. Drop style, naming, and rule citations with no behaviour impact.
4. Failure-mode checklist — for every external call, fetch, model call or
   request in the diff, ask:
   - Does it have a timeout? What happens when it stalls?
   - If it fails or is slow, is there a fallback or retry?
   - What does the user see on error? Does stale or partial data look current?
   - Does one bad item reject or drop the whole batch?
   Report each unhandled case you find.
5. Second look: after drafting your findings, re-scan the diff once more
   specifically for unhandled failure paths (timeouts, errors, fallbacks,
   stale data) before finishing. Add anything you missed.
6. Write your review to `review.md` in the workspace root, nothing else.
   Start with one line: your decision (approve / approve with comments /
   request changes).

Do not edit any other file.
