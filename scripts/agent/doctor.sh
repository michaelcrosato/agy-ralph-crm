#!/bin/bash
set -euo pipefail

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

# Package Manager check
if [ -f "pnpm-lock.yaml" ]; then
  PM="pnpm"
elif [ -f "package-lock.json" ]; then
  PM="npm"
else
  PM="pnpm"
fi

if command -v $PM &> /dev/null; then
  echo "$PM version: $($PM -v)"
else
  echo "[WARN] $PM package manager not found globally."
fi

# Biome linter check
if command -v npx &> /dev/null; then
  echo "Biome check:"
  npx biome --version || echo "no Biome globally found (will run via local npx)"
else
  echo "no npx found"
fi

echo "Diagnostics complete."
exit 0
