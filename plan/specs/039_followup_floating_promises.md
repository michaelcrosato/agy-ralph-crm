# 039 — Follow-up: Fix 22 floating-promise sites surfaced by Biome 2.4

**Phase:** 1 (follow-up of spec 002) · **Priority:** Medium · **Status:** `[ ] Todo`

## Description & Expected Impact
Biome 2.4's type-aware `lint/nursery/noFloatingPromises` rule (enabled at `warn` level by spec 002) surfaces **22 floating-promise sites**: 21 in `apps/api/src/index.ts` (webhook triggers, audit-log inserts, etc.) and 1 in `apps/web/src/app/page.tsx:306`. All pre-existed spec 002 and are FIXABLE by the rule's autofix, but each one needs hand-judgement:
- For fire-and-forget side effects (e.g. webhook dispatch): wrap in `void <promise>` to make intent explicit.
- For path-critical operations: switch to `await <promise>` so caller sees errors.

## Definition of Done & Acceptance Criteria
- [ ] Each of the 22 sites reviewed individually; choose `void` vs `await` per site context.
- [ ] Rule level promoted from `warn` to `error` in `biome.json` once all 22 are clean.
- [ ] `pnpm verify` exits 0 with the rule at `error`.
- [ ] `pnpm test` 406/406.

## Implementation Approach
- Likely sites are listed via `pnpm exec biome check . --max-diagnostics=100 | grep noFloatingPromises`.
- Treat audit/webhook outbound calls as fire-and-forget → `void`.
- Treat anything in the request-response critical path → `await`.

## Test Strategy
- Regression: 406/406.
- Manual: confirm no behavioral change for high-volume endpoints (webhook outbox dispatch should still be non-blocking).

## Rollback
Revert site-by-site if a regression appears.
