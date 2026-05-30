# TICKET007: Decompose executePendingSequenceSteps Monolith Function

## Details
- **Status**: completed
- **Priority**: High
- **Goal**: Refactor the ~1,410-line `executePendingSequenceSteps` monolith inside `packages/core/src/domain/sequences/execution.ts` into small, clean, cohesive named handlers per step type.
- **Context**: Code budget restricts file lines and complexity to maintain an easily readable and extensible domain module architecture.

---

## Scope

### In Scope
- Extract the step-type branches (`"task"`, `"sms"`, `"call"`, `"webhook"`, branch-types, email split-tests) into pure named helper functions:
  - `executeEmailStep`
  - `executeTaskStep`
  - `executeSmsStep`
  - `executeCallStep`
  - `executeWebhookStep`
  - `executeBranchStep`
- Keep `executePendingSequenceSteps` as a thin orchestrator/dispatcher (< 200 lines).
- Retain exact behavior preservation with zero functional regressions.
- No files under `packages/core/src/domain/sequences/` should exceed the 800-line budget.

### Out of Scope
- Adding new marketing sequence step-types or database schema columns.

---

## Steps to Execute
1. Analyze `packages/core/src/domain/sequences/execution.ts` to locate the loop over due memberships/steps and the main `if (step.stepType === ...)` dispatch logic.
2. Carefully extract each step-type action block into an isolated helper function that takes parameters explicitly (`step`, `membership`, `dbStore`, and mutable tracking metrics) and returns the modified state.
3. Keep the shared module fully typed and compile-checked without utilizing any unsafe type casting (`any` is disallowed).
4. Run `pnpm build` and `pnpm test` after each step-type refactor to verify 100% regression parity.
5. Run `pnpm verify` to confirm linter and formatter compliance.

---

## Acceptance Criteria
- [x] `packages/core/src/domain/sequences/execution.ts` is less than 800 lines (target < 500 lines).
- [x] Handlers `executeEmailStep`, `executeTaskStep`, `executeSmsStep`, `executeCallStep`, `executeWebhookStep`, and `executeBranchStep` are well-documented and isolated.
- [x] `pnpm build` and `pnpm verify` compile successfully with 0 lint warnings or errors.
- [x] All 451 Vitest test suites (and specifically `marketing-sequence-*.test.ts` suites) are completely green.

---

## Commands
```bash
npx vitest run packages/testing/src/marketing-sequence-call-actions.test.ts
pnpm verify
pnpm test
```
