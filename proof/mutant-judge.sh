#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
MUTANT="${MUTANT:-$HOME/cloudflare/mutant/target/release/mutant}"
OPS=cond-boundary-gt,cond-boundary-lt,logical-and-to-or,logical-or-to-and,equality-strict-to-loose-neg,inequality-to-equality,return-true-to-false,return-false-to-true
run="${1:-proof/eval}"
out="proof/mutant-1"
mkdir -p "$out/raw"
for item in "$run"/items/*.json; do
  seat=$(basename "$item" .json)
  goal=$(node -p "require('./$item').goal")
  file=$(node -p "require('./bench/hard/intents.json').intents.find(i=>i.id==='$goal').footprint[0]")
  ws="$run/work/$seat"
  [ -f "$out/raw/$seat.json" ] && continue
  (cd "$ws" && "$MUTANT" run --repo . --file "$file" --operators "$OPS" --test 'node --test' --concurrency 6 --timeout-ms 20000 --json) > "$out/raw/$seat.json" 2> "$out/raw/$seat.err" || true
  echo "$seat $(node -e 'try{const r=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));console.log(JSON.stringify(r.summary??Object.keys(r)))}catch(e){console.log("unparsed")}' "$out/raw/$seat.json")"
done
node scripts/mutant-verdict.mjs "$run" "$out"
