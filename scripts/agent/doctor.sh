#!/bin/bash
set -euo pipefail
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO_ROOT"

echo "========================================="
echo " AGENT DOCTOR: System Diagnostics"
echo "========================================="

# Node version check
if command -v node &> /dev/null; then
  NODE_VER=$(node -v)
  echo "Node version: $NODE_VER"
  # Optional warning if not Node 22
  if [[ ! "$NODE_VER" =~ ^v22 ]]; then
    echo "[WARN] Target Node baseline is v22.0.0. Current is $NODE_VER."
  fi
else
  echo "[ERROR] Node.js is not found."
  exit 1
fi

PM=""
if [ -f "pnpm-lock.yaml" ]; then
  PM="pnpm"
elif [ -f "package-lock.json" ]; then
  PM="npm"
elif [ -f "yarn.lock" ]; then
  PM="yarn"
fi

if [ -z "$PM" ]; then
  if command -v pnpm &> /dev/null; then
    PM="pnpm"
  elif command -v npm &> /dev/null; then
    PM="npm"
  elif command -v yarn &> /dev/null; then
    PM="yarn"
  fi
fi

if [ -n "$PM" ] && command -v "$PM" &> /dev/null; then
  echo "$PM version: $($PM -v)"
else
  echo "[WARN] No supported package manager command found."
fi

# Biome linter check
if command -v pnpm &> /dev/null; then
  echo "Biome check:"
  pnpm exec biome --version || echo "Biome is not available via pnpm"
elif command -v npx &> /dev/null; then
  echo "Biome check:"
  npx biome --version || echo "no Biome globally found (will run via local npx)"
else
  echo "no npx found"
fi

echo "Diagnostics complete."
exit 0
