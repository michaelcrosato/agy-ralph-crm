# Spec 059 — Migrate `embedder.ts` console.* to Structured Logger

## Description & Impact

`packages/core/src/domain/embeddings/embedder.ts` uses 3 `console.warn`/`console.error` calls instead of the structured `@crm/observability` logger. This was missed during spec 022's console.* migration because the embedder was added later.

**Impact:** Consistent structured logging across all production code; proper OTel log correlation.

## Definition of Done

- [ ] Zero `console.warn`/`console.error` calls in `embedder.ts`.
- [ ] Replaced with `createLogger({ name: 'embedder' })` from `@crm/observability`.
- [ ] All tests pass unchanged.
- [ ] `pnpm run agent:check` green.

## Approach

### Files to modify
- `packages/core/src/domain/embeddings/embedder.ts` — replace console.* with pino logger
- `packages/core/package.json` — ensure `@crm/observability` is in dependencies (may already be)

### Pattern
Import `createLogger` from `@crm/observability`. Replace `console.warn(...)` with `log.warn(...)` and `console.error(...)` with `log.error(...)`.

## Test Strategy
Regression-only. No behavioral change.

## Depends on
None.
