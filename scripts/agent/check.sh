#!/bin/bash
set -euo pipefail
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO_ROOT"

echo "========================================="
echo " AGENT CHECK: Comprehensive Verification"
echo "========================================="

fail=0

echo "Step 1: Running formatting check..."
if ! bash scripts/agent/format.sh; then
  echo "[ERROR] Formatting check failed."
  fail=1
fi

echo "Step 2: Running linting checks..."
if ! bash scripts/agent/lint.sh; then
  echo "[ERROR] Linting check failed."
  fail=1
fi

echo "Step 3: Running type checks..."
if ! bash scripts/agent/typecheck.sh; then
  echo "[ERROR] Typecheck failed."
  fail=1
fi

echo "Step 4: Running test suites..."
if ! bash scripts/agent/test.sh; then
  echo "[ERROR] Test suite failed."
  fail=1
fi

if [ "$fail" -eq 0 ]; then
  echo "All checks passed successfully."
else
  echo "Agent check failed."
fi
exit "$fail"
