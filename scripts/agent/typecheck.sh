#!/bin/bash
set -euo pipefail
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO_ROOT"

echo "========================================="
echo " AGENT TYPECHECK: tsc Compilation check"
echo "========================================="

if [ -f "pnpm-workspace.yaml" ]; then
  if command -v pnpm &> /dev/null; then
    pnpm build
  elif command -v npm &> /dev/null; then
    if command -v npx &> /dev/null; then
      echo "[WARN] pnpm not found. Falling back to npx pnpm build."
      CI=1 npx -y pnpm build
    else
      echo "[ERROR] pnpm not found and npx unavailable."
      exit 1
    fi
  else
    echo "[ERROR] No workspace typecheck command found (pnpm or npm)."
    exit 1
  fi
else
  echo "[WARN] Not a pnpm workspace workspace. Running tsc directly."
  if command -v npx &> /dev/null; then
    npx tsc --noEmit
  else
    echo "[ERROR] npx not found. Cannot run tsc typecheck."
    exit 1
  fi
fi

exit 0
