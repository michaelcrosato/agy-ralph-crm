#!/bin/bash
set -euo pipefail
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO_ROOT"

echo "========================================="
echo " AGENT LINT: Biome Linter Check"
echo "========================================="

if command -v pnpm &> /dev/null; then
  pnpm exec biome check .
elif command -v npx &> /dev/null; then
  npx biome check .
else
  echo "[ERROR] npx is not found. Cannot run Biome linter."
  exit 1
fi

exit 0
