#!/bin/bash
set -euo pipefail

echo "========================================="
echo " AGENT TYPECHECK: tsc Compilation check"
echo "========================================="

if [ -f "pnpm-workspace.yaml" ]; then
  pnpm build
else
  echo "[WARN] Not a pnpm workspace workspace. Running tsc directly."
  npx tsc --noEmit
fi

exit 0
