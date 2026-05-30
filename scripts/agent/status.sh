#!/bin/bash
set -euo pipefail
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO_ROOT"

echo "========================================="
echo " AGENT STATUS: Git Repository Status"
echo "========================================="

if command -v git &> /dev/null; then
  git status
else
  echo "[WARN] git command not found."
fi

exit 0
