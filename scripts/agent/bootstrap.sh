#!/bin/bash
set -euo pipefail

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

if ! command -v $PM &> /dev/null; then
  echo "[ERROR] $PM is not installed. Please install it first."
  exit 1
fi

echo "Running installation..."
$PM install

echo "Bootstrap completed successfully."
exit 0
