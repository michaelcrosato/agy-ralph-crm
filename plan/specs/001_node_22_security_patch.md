# 001 — Bump Node 22 → 22.22.0+ for Jan/Mar 2026 CVEs

**Phase:** 0 · **Priority:** Critical · **Status:** `[ ] Todo`

## Description & Expected Impact
Node 22.0.0 is exposed to 8+ CVEs patched in the **January 13, 2026** security release (delivered as 22.22.0) and additional fixes in **March 24, 2026**. High-severity items: CVE-2025-55131 (buffer memory leak via `vm` timeouts → leaks in-process secrets), CVE-2025-55130 (fs sandbox escape via symlink chains), CVE-2025-59465 (HTTP/2 unhandled `TLSSocket ECONNRESET` → remote DoS). The repo pins `engines.node: "22.0.0"` exactly. Bump to a permissive range so corepack-installed agents always land on a patched 22.x.

## Definition of Done & Acceptance Criteria
- [ ] `package.json#engines.node` → `">=22.22.0 <23"` (allow patch upgrades within 22.x; lock major).
- [ ] `.nvmrc` (new file) contains `22.22.0` (or whatever 22.x point release is current at execution time).
- [ ] `scripts/agent/doctor.sh` and `doctor.ps1` warn when current Node < 22.22.0 (not just != 22.x).
- [ ] CI workflow (when spec 004 lands) installs Node via `actions/setup-node@v4` with `node-version-file: .nvmrc`.
- [ ] `pnpm verify && pnpm test` green on 22.latest.
- [ ] No new runtime warnings on startup.

## Implementation Approach
- Files: `package.json` (engines), `.nvmrc` (new), `scripts/agent/doctor.sh`, `scripts/agent/doctor.ps1`.
- Update doctor scripts: parse `node -v` against `22.22.0` floor using semver compare or string sort on `vMM.mm.pp`.
- Do NOT change source code; this is a runtime/tooling bump.

## Test Strategy
- Unit: none.
- Integration: `pnpm test` must pass on the bumped runtime.
- Manual: run `pnpm run agent:doctor` on 22.0.0 → expect warn; on 22.22.0+ → expect clean.

## Rollback
Revert `engines.node`, delete `.nvmrc`. No data changes.

## References
- [Node.js Jan 2026 Security Releases](https://nodejs.org/en/blog/vulnerability/december-2025-security-releases)
- [Node.js Mar 2026 Security Releases](https://nodejs.org/en/blog/vulnerability/march-2026-security-releases)
