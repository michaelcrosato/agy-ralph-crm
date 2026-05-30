#!/bin/bash
set -euo pipefail
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO_ROOT"

echo "========================================="
echo " AGENT DOCTOR: System Diagnostics"
echo "========================================="

# Node version check — target is 22.x with floor at 22.22.0 (Jan 2026 CVE patch level).
if command -v node &> /dev/null; then
  NODE_VER=$(node -v)
  echo "Node version: $NODE_VER"
  NODE_MAJOR=$(echo "$NODE_VER" | sed -E 's/^v([0-9]+).*/\1/')
  NODE_MINOR=$(echo "$NODE_VER" | sed -E 's/^v[0-9]+\.([0-9]+).*/\1/')
  if [ "$NODE_MAJOR" -ne 22 ] || [ "$NODE_MINOR" -lt 22 ]; then
    echo "[WARN] Target Node baseline is v22.22.0+ (Jan 2026 CVE floor). Current is $NODE_VER."
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

# Advisory check — pnpm audit --json (does not fail script on moderate/low).
ADVISORY_EXIT=0
if command -v pnpm &> /dev/null && command -v node &> /dev/null; then
  echo "Advisories:"
  AUDIT_JSON=$(pnpm audit --json 2>/dev/null || true)
  if [ -n "$AUDIT_JSON" ]; then
    node -e "
      try {
        const a = JSON.parse(process.argv[1] || '{}');
        const v = (a && a.metadata && a.metadata.vulnerabilities) || {};
        const c = v.critical || 0;
        const h = v.high || 0;
        const m = v.moderate || 0;
        const l = v.low || 0;
        console.log('  ' + c + ' critical, ' + h + ' high, ' + m + ' moderate, ' + l + ' low');
        if (c > 0 || h > 0) process.exit(2);
      } catch (e) { console.log('  (could not parse audit output)'); }
    " "$AUDIT_JSON" || ADVISORY_EXIT=$?
  else
    echo "  (no audit output)"
  fi
else
  echo "Advisories: pnpm or node unavailable (skipped)"
fi

# Outdated check — pnpm outdated --recursive (informational only).
if command -v pnpm &> /dev/null && command -v node &> /dev/null; then
  echo "Outdated (major):"
  OUTDATED_JSON=$(pnpm outdated --recursive --format json 2>/dev/null || true)
  if [ -n "$OUTDATED_JSON" ]; then
    node -e "
      try {
        const raw = process.argv[1] || '';
        const m = raw.match(/^[{[][\s\S]*\$/m);
        if (!m) { console.log('  0 package(s) with a newer major'); process.exit(0); }
        const o = JSON.parse(m[0]);
        const entries = Object.values(o || {});
        const majors = entries.filter(e => {
          const cur = String(e.current || '').split('.')[0];
          const lat = String(e.latest || '').split('.')[0];
          return cur && lat && cur !== lat;
        });
        console.log('  ' + majors.length + ' package(s) with a newer major');
      } catch (e) { console.log('  (could not parse outdated output)'); }
    " "$OUTDATED_JSON" || true
  else
    echo "  0 package(s) with a newer major"
  fi
fi

# Drizzle migration validation check
echo "Step: Drizzle Migrations Check"
if ! node scripts/agent/check-migrations.mjs; then
  echo "[ERROR] Drizzle migrations validation failed."
  exit 1
fi

# Audit logs integrity validation check
echo "Step: Audit Logs Cryptographic Integrity Check"
if ! node scripts/agent/verify-audit-integrity.mjs; then
  echo "[ERROR] Audit logs integrity validation failed."
  exit 1
fi

if [ "$ADVISORY_EXIT" -ne 0 ]; then
  echo "[ERROR] high or critical advisories present; address before continuing."
  exit "$ADVISORY_EXIT"
fi

echo "Diagnostics complete."
exit 0
