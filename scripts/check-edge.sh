#!/usr/bin/env bash
set -euo pipefail
host="${1:?usage: check-edge.sh <host>}"
base="https://$host"
ip=$(dig +short "$host" @1.1.1.1 | head -1)
curl() { command curl --resolve "$host:443:$ip" "$@"; }
fail() { echo "edge check failed: $1" >&2; exit 1; }

page=$(curl -fsS "$base/") || fail "$base/ did not answer"
grep -q 'Sign in with Cloudflare' <<<"$page" || fail "landing has no Sign in with Cloudflare"
grep -q 'docs and published reports only' <<<"$page" || fail "landing does not say it is docs only"
for path in /docs /docs/scope /docs/pi /llms.txt /reports /api/reports /robots.txt; do
  status=$(curl -s -o /dev/null -w '%{http_code}' "$base$path")
  [ "$status" = 200 ] || fail "$path answered $status"
done
curl -fsS "$base/llms.txt" | grep -q '^# gleam-agents' || fail "llms.txt has no title"

location=$(curl -s -o /dev/null -w '%{redirect_url}' "$base/oauth/login")
grep -q '^https://dash.cloudflare.com/oauth2/auth' <<<"$location" || fail "/oauth/login does not redirect to Cloudflare ($location)"
grep -q 'scope=offline_access+user-details.read+account-settings.read+ai.read+aig.read+aig.run' <<<"$location" || fail "OAuth scopes are not the least set"
grep -q "redirect_uri=https%3A%2F%2F$host%2Foauth%2Fcallback" <<<"$location" || fail "redirect_uri is not $base/oauth/callback"

status=$(curl -s -o /dev/null -w '%{http_code}' -X POST -H 'content-type: application/json' --data '{}' "$base/api/reports")
[ "$status" = 401 ] || fail "anonymous publish answered $status, expected 401"
status=$(curl -s -o /dev/null -w '%{http_code}' "$base/oauth/me")
[ "$status" = 401 ] || fail "anonymous /oauth/me answered $status, expected 401"
cookie_flags=$(curl -s -D - -o /dev/null "$base/oauth/login" | grep -i '^set-cookie' || true)
grep -q '__Host-ga_oauth' <<<"$cookie_flags" || fail "flow cookie is not __Host-"
grep -qi 'secure' <<<"$cookie_flags" || fail "flow cookie is not Secure"

echo "edge ok: $base (docs, llms.txt, reports, OAuth least scopes, anonymous publish refused, __Host- Secure cookies)"
