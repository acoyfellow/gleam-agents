#!/usr/bin/env bash
set -euo pipefail
src="$(cd "$(dirname "$0")/.." && pwd)"
dest="${1:-$HOME/cloudflare/public/gleam-agents}"
mkdir -p "$dest"
find "$dest" -mindepth 1 -maxdepth 1 ! -name .git -exec rm -rf {} +
(cd "$src" && git ls-files -co --exclude-standard) \
  | grep -vE '^proof/.*\.pi/(session|events\.jsonl)|^proof/edge-1/edge-cart\.pi/(session|events)|^deploy/coey\.conf$|^\.real/' \
  | rsync -a --files-from=- "$src/" "$dest/"
node "$src/scripts/scrub.mjs" "$dest" || { rm -rf "$dest/.git"; exit 1; }
