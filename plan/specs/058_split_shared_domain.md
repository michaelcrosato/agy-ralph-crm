# Spec 058 — Split `packages/core/src/domain/shared/index.ts` (1,367 lines)

## Description & Impact

`packages/core/src/domain/shared/index.ts` is 1,367 lines — 3.4× the 400-line budget. It likely contains utility functions, field resolvers, template helpers, and shared business logic used across multiple domains. Splitting by concern improves navigability.

**Impact:** Brings the shared domain module under budget and makes utilities discoverable.

## Definition of Done

- [ ] `domain/shared/index.ts` reduced to ≤400 lines.
- [ ] Extracted sub-modules: e.g. `shared/fields.ts`, `shared/templates.ts`, `shared/calculations.ts`, `shared/formatters.ts`.
- [ ] All tests pass unchanged.
- [ ] `pnpm run agent:check` green.

## Approach

### Files to modify
- `packages/core/src/domain/shared/index.ts` → split into directory module
- New files under `packages/core/src/domain/shared/`

### Pattern
Group related functions by concern. Re-export everything from `shared/index.ts` to maintain backwards compatibility.

## Test Strategy
Regression-only. No behavioral changes.

## Depends on
None.
