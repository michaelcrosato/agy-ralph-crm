#!/bin/bash
set -euo pipefail

echo "========================================="
echo " AGENT STATUS: Git Repository Status"
echo "========================================="

if command -v git &> /dev/null; then
  git status
else
  echo "[WARN] git command not found."
fi

exit 0
