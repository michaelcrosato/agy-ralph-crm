# Spec 057 — Node.js 22.22.0 → 22.22.3 Security Patch (May 2026 CVEs)

## Description & Impact

Node.js 22.22.3 (released May 13, 2026) patches multiple security vulnerabilities:
- **CVE-2026-21637**: TLS SNICallback crash
- **CVE-2026-21710**: __proto__ header crash
- **CVE-2026-21717**: V8 HashDoS CPU exhaustion
- **CVE-2026-21714**: HTTP/2 memory leak
- **CVE-2026-21713**: HMAC timing side-channel
- **CVE-2026-21711/21716**: Permission model bypasses

The repo currently pins `.nvmrc` to `22.22.0` and `engines.node` to `>=22.22.0 <23`.

**Impact:** Closes 7+ CVEs with a version bump. No code changes required.

## Definition of Done

- [ ] `.nvmrc` updated to `22.22.3`.
- [ ] `engines.node` in root `package.json` updated to `>=22.22.3 <23`.
- [ ] `pnpm run agent:check` green (note: local runtime is 24.x, so this is a declaration change).

## Approach

### Files to modify
- `.nvmrc` — bump version string
- `package.json` — update engines.node

### Pattern
Simple version bump in two files.

## Test Strategy
`pnpm run agent:check` must remain green. No behavioral change.

## Depends on
None.
