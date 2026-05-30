# 011 — Decompose `packages/core/src/index.ts` (100+ exports / 9,505 lines)

**Phase:** 1 · **Priority:** High · **Status:** `[ ] Todo` · **Depends on:** 010

## Description & Expected Impact
Core "god module" exports 100+ unrelated functions: lead scoring, ticket routing, campaign ROI, CSAT, deduplication, sequence engagement, e-signature transitions. No domain cohesion → poor discoverability, impossible tree-shake, bundle bloat. Split into `domain/` subdirs that mirror the route split (spec 010). Critical prerequisite for specs 030 (MCP), 031 (custom objects), 032 (workflow conditions/foreach).

## Definition of Done & Acceptance Criteria
- [ ] New directory `packages/core/src/domain/` with one subdir per bounded context:
  - `leads/`, `opportunities/`, `accounts/`, `contacts/`, `campaigns/`, `sequences/`, `service/`, `forecasting/`, `commissions/`, `dedup/`, `migrations/`, `esignature/`, `surveys/`, `csv/`.
- [ ] Each subdir has `index.ts` re-exporting public surface; private helpers stay in `_internal.ts`.
- [ ] `packages/core/src/index.ts` re-exports from each subdir; size < 100 lines.
- [ ] No subdir file exceeds 800 lines (ralph.yml prefers 400; allow 2× tolerance during transition).
- [ ] Type exports preserved verbatim (zero breaking changes for consumers).
- [ ] `pnpm test` → 403/403 pass.
- [ ] `pnpm build` succeeds and `dist/index.d.ts` exports identical symbols.

## Implementation Approach
- Sub-agent strategy: one Agent per bounded context. Hand each: `function names to extract, target file path, expected re-exports`.
- Resolve cross-domain helpers (e.g., `withTenant`-like utilities) into `packages/core/src/_shared/`.
- Use `tsc --noEmit` after each batch to catch broken imports early.
- Snapshot the public API via `pnpm exec tsc --emitDeclarationOnly` and diff before/after to ensure zero surface change.

## Test Strategy
- Regression: `pnpm test` 403/403.
- API surface: compare `packages/core/dist/index.d.ts` symbol list before and after → must be identical.
- Bundle: optional — measure `apps/api` bundle size via `du -sh apps/api/dist` and confirm no regression > 5%.

## Rollback
`git restore packages/core/src/`.
