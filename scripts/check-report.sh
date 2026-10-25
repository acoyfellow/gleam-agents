#!/usr/bin/env bash
set -euo pipefail
host="${1:?usage: check-report.sh <host>}"
cd "$(dirname "$0")/.."
ip=$(dig +short "$host" @1.1.1.1 | head -1)
id=$(node -p 'require("./proof/prod-auth.json").reportId')
json=$(curl --resolve "$host:443:$ip" -fsS "https://$host/api/reports/$id")
node -e '
const r = JSON.parse(process.argv[1]); const local = require("./proof/eval/score.json");
if (r.id !== process.argv[2]) throw new Error("wrong id");
if (r.summary.passed !== local.passed || r.summary.seats !== local.seats) throw new Error(`prod report ${r.summary.passed}/${r.summary.seats} != local ${local.passed}/${local.seats}`);
console.log(`report ${r.id} on prod: ${r.summary.passed}/${r.summary.seats}, matches proof/eval/score.json`);
' "$json" "$id"
curl --resolve "$host:443:$ip" -fsS "https://$host/reports/$id" | grep -q '<table>' || { echo "report page does not render" >&2; exit 1; }
