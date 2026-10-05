#!/usr/bin/env bash
# Mirror canonical `product-film/` to the three distribution mirrors. Thin wrapper around bin/transform.mjs.
#
# Usage:
#   bin/sync-mounts.sh           # write the mirrors
#   bin/sync-mounts.sh --check   # CI gate: exit 1 if any mirror drifts
#
# Source of truth is `product-film/` only. Never edit the mirrors directly.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
exec node "$ROOT/bin/transform.mjs" "$@"
