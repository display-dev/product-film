#!/usr/bin/env bash
# Syntax-checks every shell, Node and Python file in the canonical mount and bin/. Run by CI; safe to run locally.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
fail=0
while IFS= read -r -d '' f; do bash -n "$f" || { echo "bash: $f"; fail=1; }; done < <(find product-film bin dev-scripts -name '*.sh' -print0)
while IFS= read -r -d '' f; do node --check "$f" || { echo "node: $f"; fail=1; }; done < <(find product-film bin -name '*.mjs' -print0; find product-film -name '*.cjs' -print0)
# .js files are CommonJS scripts or browser ES modules; check each in the mode it uses.
while IFS= read -r -d '' f; do
  if grep -qE '^\s*(import|export)\s' "$f"; then
    node --input-type=module --check < "$f" || { echo "node (module): $f"; fail=1; }
  else
    node --check "$f" || { echo "node: $f"; fail=1; }
  fi
done < <(find product-film -name '*.js' -print0)
while IFS= read -r -d '' f; do python3 -m py_compile "$f" 2>/dev/null || { python3 -m py_compile "$f"; echo "python: $f"; fail=1; }; done < <(find product-film -name '*.py' -print0)
while IFS= read -r -d '' f; do node -e "JSON.parse(require('fs').readFileSync(process.argv[1],'utf8'))" "$f" || { echo "json: $f"; fail=1; }; done < <(find product-film -name '*.json' -print0)
find product-film -name __pycache__ -type d -prune -exec rm -rf {} +
[ "$fail" = 0 ] && echo "OK · syntax"
exit "$fail"
