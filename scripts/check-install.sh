#!/usr/bin/env bash
set -euo pipefail
repo="${GLEAM_AGENTS_GIT:-https://github.com/acoyfellow/gleam-agents}"
box=/tmp/ga/install-check
rm -rf "$box"
mkdir -p "$box/agent" "$box/project"
git clone -q --depth 1 "$repo" "$box/clone"
test -f "$box/clone/pi/index.ts"
node -e 'const p=require(process.argv[1]); if (!p.keywords.includes("pi-package") || !p.pi.extensions.includes("./pi/index.ts")) process.exit(1)' "$box/clone/package.json"
printf '{"packages":[],"extensions":[]}' > "$box/agent/settings.json"
(cd "$box/project" && PI_CODING_AGENT_DIR="$box/agent" perl -e 'alarm 180; exec @ARGV' pi install "git:${repo#https://}" > "$box/install.log" 2>&1)
grep -q "gleam-agents" "$box/agent/settings.json"
tools=$(cd "$box/project" && PI_CODING_AGENT_DIR="$box/agent" perl -e 'alarm 120; exec @ARGV' pi -p --mode json --no-session --offline --tools gleam_agents_run,gleam_agents_publish,gleam_agents_reports ${GA_CHECK_EXTENSION:+-e "$GA_CHECK_EXTENSION"} --provider "${GA_CHECK_PROVIDER:-anthropic}" --model claude-haiku-4-5 "Say ok." 2>/dev/null | node -e '
let s=""; process.stdin.on("data",d=>s+=d).on("end",()=>{const names=new Set();
for (const l of s.split("\n")) { try { const e=JSON.parse(l); for (const t of (e.message?.toolsAdded ?? [])) names.add(t.name ?? t); } catch {} }
console.log([...names].filter(n=>n.startsWith("gleam_agents")).sort().join(","))})')
echo "installed tools: $tools"
test "$tools" = "gleam_agents_publish,gleam_agents_reports,gleam_agents_run"
