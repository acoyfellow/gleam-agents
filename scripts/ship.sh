#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../worker"
conf="${1:?usage: scripts/ship.sh deploy/<instance>.conf}"
set -a; . "../$conf"; set +a
for key in GA_ACCOUNT_ID GA_DOMAIN GA_OAUTH_CLIENT_ID; do
  [ -n "${!key:-}" ] || { echo "missing $key in $conf" >&2; exit 2; }
done
export CLOUDFLARE_ACCOUNT_ID="$GA_ACCOUNT_ID"
node scripts/build-docs.mjs
npx tsc -p .
npx vitest run
npx wrangler deploy --domain "$GA_DOMAIN" --var "OAUTH_CLIENT_ID:$GA_OAUTH_CLIENT_ID"
secrets=$(npx wrangler secret list 2>/dev/null || true)
for name in OAUTH_CLIENT_SECRET SESSION_SECRET TOKEN_ENC_KEY; do
  grep -q "\"$name\"" <<<"$secrets" || { echo "set the Worker secret $name: CLOUDFLARE_ACCOUNT_ID=$GA_ACCOUNT_ID npx wrangler secret put $name" >&2; exit 1; }
done
bash ../scripts/check-edge.sh "$GA_DOMAIN"
