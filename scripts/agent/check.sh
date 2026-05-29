#!/bin/bash
set -euo pipefail

echo "========================================="
echo " AGENT CHECK: Comprehensive Verification"
echo "========================================="

echo "Step 1: Running linting checks..."
bash scripts/agent/lint.sh

echo "Step 2: Running type checks..."
bash scripts/agent/typecheck.sh

echo "Step 3: Running test suites..."
bash scripts/agent/test.sh

echo "All checks passed successfully."
exit 0
