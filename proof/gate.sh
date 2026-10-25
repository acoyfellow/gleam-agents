#!/usr/bin/env bash
set -uo pipefail
cd "$(dirname "$0")/.."
host="${GA_DOMAIN:-gleam-agents.coey.dev}"
fail=0
check() { if eval "$2" >/tmp/ga-gate.out 2>&1; then echo "✓ $1"; else echo "✗ $1"; sed 's/^/    /' /tmp/ga-gate.out | tail -5; fail=1; fi; }

check "gleam core builds and its tests pass" 'gleam test'
check "worker typechecks and its tests pass" '(cd worker && npx tsc -p . && npx vitest run)'
check "every smoke receipt recomputes and agrees" 'for d in proof/smoke-* proof/scope-*; do node scripts/score.mjs "$d" >/dev/null || exit 1; done'
check "scope probe: writes outside scope refused" 'node -e "const r=require(\"./proof/scope-1/items/p1-haiku-scope.json\"); process.exit(r.graded_pass && r.scope_denials>=2 ? 0 : 1)"'
check "eval receipt exists and recomputes" 'test -s proof/eval/score.json && node scripts/score.mjs proof/eval >/dev/null'
check "eval verdict is proven or disproven, with numbers" 'node -e "const v=require(\"./proof/eval/verdict.json\"); process.exit([\"proven\",\"disproven\"].includes(v.verdict) && typeof v.metric===\"string\" && v.ours!==undefined && v.baseline!==undefined ? 0 : 1)"'
check "prod edge: docs, OAuth least scopes, anonymous refused" "bash scripts/check-edge.sh $host"
check "auth receipt: a signed-in CLI token publishes on prod" 'node -e "const r=require(\"./proof/prod-auth.json\"); process.exit(r.me.signedIn && r.me.via===\"cli-token\" && r.publishStatus===201 ? 0 : 1)"'
check "report reachable on prod and matches the local receipt" "bash scripts/check-report.sh $host"
check "row pi harness: pi seat receipt and hidden pass" 'node -e "const r=require(\"./proof/pi-1/items/pi-cart-merge.json\"), p=require(\"./proof/pi-1/items/pi-cart-merge.pi-receipt.json\"); process.exit(r.graded_pass && p.harness===\"pi\" && p.outcome===\"done\" ? 0 : 1)" && node scripts/score.mjs proof/pi-1 >/dev/null'
check "row pi scope guard: 2 refusals, allowed write landed" 'node scripts/score.mjs proof/pi-scope-1 >/dev/null && test "$(grep -c denied proof/pi-scope-1/items/pi-scope.pi-ledger.jsonl)" -ge 2'
check "row mcp in shapes: 1 mcp call logged by the server" 'node -e "const p=require(\"./proof/mcp-1/items/mcp-word.pi-receipt.json\"), r=require(\"./proof/mcp-1/items/mcp-word.json\"); process.exit(p.mcp_calls>=1 && r.graded_pass ? 0 : 1)" && test -s proof/mcp-1/items/mcp-word.mcp-calls.jsonl'
check "row resume: killed seat resumed same session and passed" 'node -e "const r=require(\"./proof/resume-1/resume.json\"); process.exit(r.verdict===\"proven\" ? 0 : 1)" && test "$(grep -c Continue proof/resume-1/session-roles.jsonl)" = 1'
check "row edge workspaces: ply commit on Artifacts, merged, fsck ok" 'node -e "const r=require(\"./proof/edge-1/edge.json\"); process.exit(r.verdict===\"proven\" && r.local_files_in_workspace===0 ? 0 : 1)"'
check "row mutant judge: verdict recomputes from raw mutant output" 'node scripts/mutant-verdict.mjs proof/eval proof/mutant-1 >/dev/null && node -e "const v=require(\"./proof/mutant-1/verdict.json\"); process.exit([\"proven\",\"disproven\"].includes(v.verdict) && v.seats_scored===17 ? 0 : 1)"'
check "roadmap doc and status.json agree on every verdict" 'node scripts/check-roadmap.mjs'
check "no credentials in tracked files or receipts" '! git ls-files -co --exclude-standard | xargs grep -lE "art_v2_[a-z]_[0-9a-f]{20}|ga_[0-9a-f]{64}|sk-ant-[A-Za-z0-9]{10}" 2>/dev/null | grep -v "^worker/test/"'
check "clean install: pi install from the public repo loads the tools" 'GA_CHECK_EXTENSION=$HOME/.pi/agent/extensions/opencode-cloudflare GA_CHECK_PROVIDER=$(cat .real/provider) bash scripts/check-install.sh'
check "repo shape v3 written" 'test -s ../.context/MY_REPO_SHAPE_V3.md && grep -q "docs-only instance" ../.context/MY_REPO_SHAPE_V3.md'
check "my.ax push receipt present" 'node -e "const r=require(\"./proof/myax-push.json\"); process.exit(r.ok && r.delivered>=1 ? 0 : 1)"'

if [ "$fail" = 0 ]; then echo "GATE PASS"; else echo "GATE FAIL"; fi
exit "$fail"
