#!/bin/bash
set -euo pipefail

echo "========================================="
echo " AGENT LINT: Biome Linter Check"
echo "========================================="

if command -v npx &> /dev/null; then
  npx biome check .
else
  echo "[ERROR] npx is not found. Cannot run Biome linter."
  exit 1
fi

exit 0
