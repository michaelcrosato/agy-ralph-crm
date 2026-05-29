#!/bin/bash
set -euo pipefail

echo "========================================="
echo " AGENT TEST: Vitest Execution"
echo "========================================="

if [ -f "pnpm-workspace.yaml" ]; then
  pnpm test
else
  echo "[WARN] No pnpm workspace found. Running standard npm test."
  npm test
fi

exit 0
