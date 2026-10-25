#!/usr/bin/env bash
set -euo pipefail
umask 077
cd "$(dirname "$0")/.."
. .real/env.sh
out=proof/edge-1
rm -rf "$out" /tmp/ga/edge-seed /tmp/ga/edge-check
mkdir -p "$out" /tmp/ga
creds=.real/artifacts-edge-smoke.json
remote=$(node -p "require('./$creds').remote")
token=$(node -p "require('./$creds').token")
export GIT_TERMINAL_PROMPT=0 GIT_CONFIG_COUNT=1 GIT_CONFIG_KEY_0=http.extraHeader GIT_CONFIG_VALUE_0="Authorization: Bearer $token"
remote_user="$remote"

if ! git ls-remote "$remote_user" refs/heads/main 2>/dev/null | grep -q main; then
  rsync -a --exclude node_modules bench/hard/seed/ /tmp/ga/edge-seed/
  (cd /tmp/ga/edge-seed && git init -q -b main && git add -A && git -c user.name=seed -c user.email=seed@x -c core.hooksPath=/dev/null commit -qm seed && git push -q "$remote_user" main)
fi
seat_branch="refs/heads/seat-$(date +%s)"

node -e '
const s=require("./catalog/haiku45-pi.json");
s.name="haiku45-pi-edge"; s.seat_id="edge-cart"; s.writable=["src/cart.ts","test/cart.test.ts"];
s.tools=["repo_list","repo_read","repo_edit"];
s.pi.extensions=[...s.pi.extensions, process.cwd()+"/harness/pi/ply-workspace.ts"];
require("fs").writeFileSync(process.argv[1], JSON.stringify(s));' "$out/shape.json"

mkdir -p "$out/empty-workspace"
cat > "$out/prompt.md" <<'EOF'
You work on a git repository through three tools only: repo_list, repo_read, repo_edit. There is no local folder and no shell.
Task: in src/cart.ts, add and export a function `cartItemCount(cart)` that returns the sum of `quantity` over `cart.lines`. Read src/cart.ts first to see the types. Use repo_edit to insert it (find an exact existing snippet, replace it with that snippet plus your function). Then stop and say what you committed.
EOF

FLEET_REMOTE="$remote" FLEET_REMOTE_TOKEN="$token" FLEET_BRANCH="$seat_branch" FLEET_BASE=refs/heads/main \
  node harness/pi/run-seat.mjs "$PWD/$out/empty-workspace" "$out/shape.json" "$out/prompt.md" "$out/receipt.json"

node --input-type=module -e '
import { mergeBranch, Tracer, arrayExporter } from "'"$HOME"'/cloudflare/public/ply/src/index.js";
const r = await mergeBranch(process.argv[1], { ref: "refs/heads/main", from: process.argv[2], author: { name: "fleet", email: "fleet@gleam-agents.coey.dev" }, message: "merge seat" }, { auth: { bearer: process.argv[3] }, tracer: new Tracer({ exporter: arrayExporter([]) }) });
process.stdout.write(JSON.stringify({ kind: r.kind ?? r.outcome ?? Object.keys(r).join(","), commit: r.newCommit ?? r.commit ?? null }));' "$remote" "$seat_branch" "$token" > "$out/merge.json"

git clone -q "$remote_user" /tmp/ga/edge-check
(cd /tmp/ga/edge-check && git fsck --no-progress >/dev/null 2>&1 && echo ok || echo bad) > "$out/fsck.txt"
cat > /tmp/ga/edge-check/test/count.check.test.ts <<'EOF'
import { test } from "node:test";
import assert from "node:assert/strict";
import * as cart from "../src/cart.ts";
test("cartItemCount sums quantities", () => {
  const fn = (cart as Record<string, unknown>).cartItemCount as (c: unknown) => number;
  assert.equal(typeof fn, "function");
  assert.equal(fn({ lines: [{ quantity: 2 }, { quantity: 3 }] }), 5);
  assert.equal(fn({ lines: [] }), 0);
});
EOF
set +e
(cd /tmp/ga/edge-check && node --test test/count.check.test.ts > /dev/null 2>&1 && node --test > /dev/null 2>&1); tests=$?
set -e
ls "$out/empty-workspace" | wc -l | tr -d ' ' > "$out/local-files.txt"
node -e '
const fs=require("fs"); const out=process.argv[1];
const r=JSON.parse(fs.readFileSync(out+"/receipt.json")); const m=JSON.parse(fs.readFileSync(out+"/merge.json"));
const ledger=fs.readFileSync(out+"/../edge-1/edge-cart.pi/ledger.jsonl","utf8").split("\n").filter(Boolean).map(JSON.parse);
const edits=ledger.filter(e=>e.tool==="repo_edit"&&e.commit);
const v={claim:"a pi seat works on an Artifacts branch through ply with no local checkout, and the branch merges",
 outcome:r.outcome, edits:edits.length, push_bytes:edits.map(e=>e.pushBytes), merge:m, fsck:fs.readFileSync(out+"/fsck.txt","utf8").trim(),
 local_files_in_workspace:+fs.readFileSync(out+"/local-files.txt","utf8"), bash_calls:ledger.filter(e=>e.tool==="bash").length,
 tests_pass_after_merge:+process.argv[2]===0, usd:r.usd};
v.verdict = v.edits>=1 && v.fsck==="ok" && v.local_files_in_workspace===0 && v.bash_calls===0 && v.tests_pass_after_merge ? "proven" : "disproven";
fs.writeFileSync(out+"/edge.json", JSON.stringify(v,null,1)); console.log(JSON.stringify(v));' "$out" "$tests"
