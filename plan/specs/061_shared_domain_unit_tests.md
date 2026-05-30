# Spec 061 — Add Dedicated Unit Tests for `packages/core/src/domain/shared/`

## Description & Impact

The `packages/core/src/domain/shared/` module (1,367 lines) contains shared utility functions used across multiple domains — field resolution, template interpolation, sending window calculations, suppression checks, etc. These are currently exercised only indirectly through integration tests but lack dedicated unit coverage.

**Impact:** Direct unit tests for shared utilities catch regressions faster, document edge cases, and enable confident refactoring (prep for spec 058's split).

## Definition of Done

- [ ] `packages/testing/src/shared-domain-utils.test.ts` created with ≥15 targeted test cases.
- [ ] Tests cover: `getFieldValue`, `getNextValidSendingTime`, `isRecordSuppressedOrExcluded`, `isTimezoneEligible`, template compilation, date/time helpers.
- [ ] All edge cases: null/undefined inputs, empty arrays, timezone boundaries, DST transitions.
- [ ] `pnpm run agent:check` green.

## Approach

### Files to create
- `packages/testing/src/shared-domain-utils.test.ts`

### Pattern
Import shared functions directly from `@crm/core` (they should be exported). Write focused unit tests with descriptive names. No mocking needed — these are pure functions.

## Test Strategy
New tests. Does not modify existing behavior.

## Depends on
None. Should execute before spec 058 (split) to establish a regression baseline.
