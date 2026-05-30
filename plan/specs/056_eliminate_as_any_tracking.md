# Spec 056 — Eliminate `as any` Casts in Sequence Tracking (tracking.ts)

## Description & Impact

`packages/core/src/domain/sequences/tracking.ts` contains 6 `as any` casts on lead/contact objects to access properties like `engagementScore`. These bypass TypeScript's type system and hide potential runtime errors. The fix is to properly type the store return values or use type guards.

**Impact:** Improves type safety in the sequence engagement tracking engine, preventing silent bugs on property access.

## Definition of Done

- [ ] Zero `as any` casts remaining in `tracking.ts`.
- [ ] Proper type narrowing or interface extensions used instead.
- [ ] All sequence tracking tests pass unchanged.
- [ ] `pnpm run agent:check` green.

## Approach

### Files to modify
- `packages/core/src/domain/sequences/tracking.ts` — replace `as any` with proper types
- `packages/core/src/types.ts` — add missing properties to Lead/Contact interfaces if needed

### Pattern
Add `engagementScore`, `lastEngagedAt`, etc. to the Lead and Contact type interfaces in `types.ts` if they aren't already there. Then remove the `as any` casts.

## Test Strategy
Regression-only. All sequence tracking tests must pass unchanged.

## Depends on
None.
