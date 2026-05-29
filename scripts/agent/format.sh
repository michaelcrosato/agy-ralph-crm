#!/bin/bash
set -euo pipefail

echo "========================================="
echo " AGENT FORMAT: Biome Lint & Write"
echo "========================================="

if command -v npx &> /dev/null; then
  npx biome check --write .
else
  echo "[ERROR] npx is not found. Cannot autoformat."
  exit 1
fi

exit 0
