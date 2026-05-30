# 003 — Vitest 1.6 → 3.x (40% faster on large suites, Rust sharding)

**Phase:** 0 · **Priority:** Medium · **Status:** `[ ] Todo`

## Description & Expected Impact
Vitest 3.x delivers ~40% reduction in full-suite execution time for 10K+ test codebases and ships native Rust sharding for suites exceeding 5K tests. Repo has 403 tests (well-under sharding threshold) but Vitest 1.6's redesigned public API + workspace inline config + browser mode unlock future E2E work (spec 021).

## Definition of Done & Acceptance Criteria
- [ ] `vitest` bumped to `^3.x` in 5 package.json files (root none; apps/api, apps/web, packages/core, packages/db, packages/testing, plus any other package declaring vitest).
- [ ] Any `vitest.config.ts` / `vite.config.ts` migrated per Vitest 3 changelog (notably: API renames around `test.environment` if used).
- [ ] `pnpm test` exits 0 with 403/403 still passing.
- [ ] `--passWithNoTests` flag still respected in package-level `test` scripts.

## Implementation Approach
- Read each `package.json` declaring `"vitest"` (grep for `"vitest"` under `devDependencies`).
- Bump pin to `^3.x` (latest stable at execution time).
- `pnpm install` to refresh lockfile.
- Read Vitest 3 migration notes (linked below) and apply any required `vitest.config` updates.
- Verify: `pnpm test` 403/403.

## Test Strategy
- Regression: full suite must pass with identical assertion counts.
- Sanity: run `pnpm test -- --reporter=verbose` once locally to confirm output format intact.

## Rollback
Revert `vitest` pin to `^1.6.0`, `pnpm install`.

## References
- [Vitest 3 release notes](https://github.com/vitest-dev/vitest/releases)
- [Vitest vs Jest 2026 benchmarks](https://www.pkgpulse.com/blog/vitest-3-vs-jest-30-2026)
