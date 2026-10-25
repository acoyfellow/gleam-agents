#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
plan="${1:-evals/smoke/plan.json}"
out="${2:-proof/smoke-$(date -u +%Y%m%dT%H%M%SZ)}"
export FLEET_ROOT="$PWD"
export CF_BUILD_BENCH="${CF_BUILD_BENCH:-$PWD/../cf-build-bench}"
gleam run -- run "$plan" "$out"
node scripts/score.mjs "$out"
