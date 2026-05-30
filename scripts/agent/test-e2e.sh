#!/bin/bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO_ROOT"

echo "========================================="
echo " AGENT E2E: End-to-End Test Check"
echo "========================================="

if [ -f "e2e/config.ts" ] || [ -f "playwright.config.ts" ] || [ -f "playwright.config.js" ] || [ -f "playwright.config.mjs" ] || [ -f "playwright.config.cjs" ]; then
  if [ -f "pnpm-workspace.yaml" ] && command -v pnpm &> /dev/null; then
    pnpm exec playwright test
  elif command -v npx &> /dev/null; then
    npx playwright test
  else
    echo "[ERROR] No package-manager or npx fallback available to run Playwright."
    exit 1
  fi
else
  echo "[WARN] No E2E Playwright config found. Skipping e2e checks."
fi

exit 0
