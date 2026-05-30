#!/bin/bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO_ROOT"

echo "========================================="
echo " AGENT BOOTSTRAP: Workspace Setup"
echo "========================================="

# Detect package manager
if [ -f "pnpm-lock.yaml" ]; then
  PM="pnpm"
elif [ -f "package-lock.json" ]; then
  PM="npm"
elif [ -f "yarn.lock" ]; then
  PM="yarn"
else
  echo "[WARN] No lockfile found. Defaulting to pnpm."
  PM="pnpm"
fi

echo "Detected package manager: $PM"

if ! command -v "$PM" &> /dev/null; then
  if command -v pnpm &> /dev/null; then
    echo "[WARN] $PM not found; using pnpm."
    PM="pnpm"
  elif command -v npm &> /dev/null; then
    echo "[WARN] $PM not found; using npm."
    PM="npm"
  elif command -v yarn &> /dev/null; then
    echo "[WARN] $PM not found; using yarn."
    PM="yarn"
  elif command -v npx &> /dev/null; then
    echo "[WARN] $PM not found; using npx -y pnpm."
    PM="npx -y pnpm"
  else
    echo "[ERROR] No supported package manager found. Please install pnpm/npm/yarn."
    exit 1
  fi
fi

if [ "$PM" != "npx -y pnpm" ] && ! command -v "$PM" &> /dev/null; then
  echo "[ERROR] $PM is still not installed."
  exit 1
fi

echo "Running installation..."
eval "$PM install"

echo "Bootstrap completed successfully."
exit 0
