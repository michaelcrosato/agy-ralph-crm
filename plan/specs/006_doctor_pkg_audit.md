# 006 — Extend `agent:doctor` with `pnpm audit` + outdated checks

**Phase:** 0 · **Priority:** Medium · **Status:** `[ ] Todo`

## Description & Expected Impact
Doctor currently reports Node + pnpm + Biome versions only. Extend to surface advisory counts (`pnpm audit --json`) and outdated majors (`pnpm outdated --recursive --format json`) so the weekly maintenance loop can open security/upgrade specs autonomously. Non-fatal; reports counts and exits 0 unless a CVE-rated `high|critical` advisory exists.

## Definition of Done & Acceptance Criteria
- [ ] `scripts/agent/doctor.sh` + `doctor.ps1` extended with two new sections:
  - **Advisories**: parse `pnpm audit --json`; print `Advisories: 0 critical, 0 high, 3 moderate, 7 low`. Exit ≠ 0 if any `critical` or `high`.
  - **Outdated**: parse `pnpm outdated --recursive --format json`; print count of `major` updates available; never fails.
- [ ] Both scripts respect `--quiet` flag (suppress non-error output).
- [ ] `pnpm run agent:doctor` runs in < 30s on a warm cache.

## Implementation Approach
- Use `jq` if available (Linux) or `ConvertFrom-Json` (PowerShell) for parsing.
- Fallback: parse text output if JSON helpers unavailable.
- Treat `pnpm audit` exit code: 0 = no advisory, non-zero = advisories found (parse to classify).
- Do NOT fail the script on `moderate` or `low` advisories; only `high`/`critical`.

## Test Strategy
- Unit: not applicable (shell scripts).
- Integration: temporarily add a known-vulnerable dep (e.g., old `lodash@4.17.10`) → `agent:doctor` should fail with high advisory count. Revert.

## Rollback
Revert `doctor.sh` and `doctor.ps1` to prior versions.
