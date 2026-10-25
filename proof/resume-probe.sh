#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
. .real/env.sh
export FLEET_ROOT="$PWD"
out="${1:-proof/resume-1}"
rm -rf "$out"
mkdir -p "$out/work/r-cart" "$out/items"
rsync -a bench/hard/seed/ "$out/work/r-cart/"
ws="$PWD/$out/work/r-cart"
seat="$PWD/$out/work/r-cart.pi"
node -e '
const s=require("./catalog/haiku45-pi.json"); s.seat_id="r-cart"; s.writable=["src/","test/"];
require("fs").writeFileSync(process.argv[1], JSON.stringify(s));' "$out/shape.json"

node harness/pi/run-seat.mjs "$ws" "$out/shape.json" evals/hard/prompts/cart-merge.md "$out/first.json" &
runner=$!
for _ in $(seq 1 120); do
  sleep 1
  if [ -f "$seat/events.jsonl" ] && [ "$(grep -c '"type":"turn_end"' "$seat/events.jsonl" || true)" -ge 3 ]; then break; fi
done
turns_before=$(grep -c '"type":"turn_end"' "$seat/events.jsonl" || true)
pi_pid=$(cat "$seat/pid")
kill -9 "$pi_pid"
wait "$runner" || true
echo "killed pi pid $pi_pid after $turns_before turns"

FLEET_RESUME=1 node harness/pi/run-seat.mjs "$ws" "$out/shape.json" evals/hard/prompts/cart-merge.md "$out/second.json"

mkdir -p "$ws/test/accept" && cp bench/hard/accept/cart-merge.test.ts bench/hard/accept/fixtures.ts "$ws/test/accept/"
set +e
(cd "$ws" && node --test --test-reporter=dot test/accept/cart-merge.test.ts) > "$out/grade.txt" 2>&1
grade=$?
set -e
rm -rf "$ws/test/accept"

node -e '
const fs=require("fs"); const [out, before, grade] = process.argv.slice(1);
const first=JSON.parse(fs.readFileSync(out+"/first.json")); const second=JSON.parse(fs.readFileSync(out+"/second.json"));
const sessionFiles=fs.readdirSync(out+"/work/r-cart.pi/session", {recursive:true}).filter(f=>String(f).endsWith(".jsonl"));
const r={claim:"a pi seat killed mid-run resumes the same session and finishes", turns_before_kill:+before, first_outcome:first.outcome, second_outcome:second.outcome, resumed:second.resumed, same_session:first.session_id===second.session_id, session_files:sessionFiles.length, hidden_pass:+grade===0, usd:Math.round((first.usd+second.usd)*10000)/10000};
r.verdict = r.first_outcome==="killed"||r.first_outcome==="harness_error" ? (r.resumed&&r.same_session&&r.session_files===1&&r.second_outcome==="done"&&r.hidden_pass ? "proven" : "disproven") : "invalid: first run was not interrupted";
fs.writeFileSync(out+"/resume.json", JSON.stringify(r,null,1)); console.log(JSON.stringify(r));' "$out" "$turns_before" "$grade"
