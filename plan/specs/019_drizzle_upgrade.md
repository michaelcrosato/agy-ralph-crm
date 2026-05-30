# 019 — Drizzle 0.30 → latest 0.4x; adopt migration conflict detection

**Phase:** 1 · **Priority:** Medium · **Status:** `[ ] Todo` · **Depends on:** 013

## Description & Expected Impact
Drizzle 0.4x adds migration conflict detection (catches branched migrations that touch the same object), 10× faster schema introspection, MSSQL support (not needed but cleaner core), and proper SQLite tree merging. Drizzle 1.0 is in beta — defer until GA. Bump within 0.x line to capture stability wins.

## Definition of Done & Acceptance Criteria
- [ ] `drizzle-orm` and `drizzle-kit` bumped to latest stable 0.x (verify both packages.json: `packages/db`, anywhere else they appear).
- [ ] Migrations regenerate cleanly (`drizzle-kit generate` → no diff vs committed migrations beyond a header bump).
- [ ] CI job runs `drizzle-kit check` (new in 0.4x) to detect migration branch conflicts.
- [ ] `pnpm test` 403/403.

## Implementation Approach
- Bump pin in `packages/db/package.json`.
- Re-run `pnpm install`, `pnpm exec drizzle-kit generate`.
- Add `pnpm run db:check` script calling `drizzle-kit check`.
- Wire into CI (`.github/workflows/ci.yml`) as a `db-check` job.

## Test Strategy
- Regression: 403/403.
- New: a synthetic conflicting migration → `drizzle-kit check` exits non-zero.

## Rollback
Revert pins.

## References
- [Drizzle 0.4x release notes](https://github.com/drizzle-team/drizzle-orm/releases)
