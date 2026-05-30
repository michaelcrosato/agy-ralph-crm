#!/bin/bash
set -euo pipefail
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO_ROOT"

echo "========================================="
echo " AGENT TEST: Vitest Execution"
echo "========================================="

if [ -f "pnpm-workspace.yaml" ]; then
  if command -v pnpm &> /dev/null; then
    pnpm test
  elif command -v npm &> /dev/null; then
    if command -v npx &> /dev/null; then
      echo "[WARN] pnpm not found. Falling back to npx pnpm."
      CI=1 npx -y pnpm test
    else
      echo "[ERROR] pnpm not found and npx unavailable."
      exit 1
    fi
  else
    echo "[ERROR] No workspace test runner found (pnpm/npm)."
    exit 1
  fi
else
  echo "[WARN] No pnpm workspace found. Running standard npm test."
  if command -v npm &> /dev/null; then
    npm test
  else
    echo "[ERROR] npm not found. No test command available."
    exit 1
  fi
fi

exit 0
