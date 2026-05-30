# 043 — Follow-up: Decompose `executePendingSequenceSteps` (sequences/execution.ts)

**Phase:** 1 (follow-up of spec 011 / 042) · **Priority:** Medium · **Status:** `[ ] Todo`

## Description & Expected Impact

Spec 011 decomposed `packages/core/src/index.ts` into `domain/` subdirs but left
`domain/sequences/index.ts` as a 4,303-line monolith. Spec **042** split that file
by export into 8 cohesive domain modules behind a barrel (`enrollment`, `execution`,
`segments`, `tracking`, `analytics`, `analytics-summary`, `scoring`, `lifecycle`),
all 410 tests green.

One module remains over the 800-line budget: **`execution.ts` is ~1,437 lines because
`executePendingSequenceSteps` is a single ~1,410-line function** — a file-level split
cannot reduce it. This follow-up performs the behavior-preserving _internal_
decomposition.

## Definition of Done & Acceptance Criteria

- [ ] Extract the per-step-type branches of `executePendingSequenceSteps` (dispatched
      today via `if (step.stepType === "task" | "sms" | "call" | "webhook")` plus the
      email/branch/split-test path) into named handlers — e.g. `executeEmailStep`,
      `executeTaskStep`, `executeSmsStep`, `executeCallStep`, `executeWebhookStep`,
      `executeBranchStep`.
- [ ] `executePendingSequenceSteps` becomes a thin dispatcher (< 200 lines) that loops
      due steps and delegates to a handler.
- [ ] No file under `packages/core/src/domain/sequences/` exceeds 800 lines; flag any
      remaining > 600 in PROGRESS.
- [ ] Behavior preserved: **410/410** `@crm/testing` tests pass without modification.
- [ ] `biome check` + `tsc` clean for `@crm/core`.

## Implementation Approach

- The function is a loop over due memberships/steps with an if-chain on `step.stepType`
  and inline branch-rule evaluation (`branchType === "email_open" | "email_click"`).
- Lift each branch body into a handler taking the loop-local context explicitly
  (`step`, `membership`, `dbStore`, and the result accumulators it mutates) and
  returning the same effect it performs inline today. No hidden globals — keep
  `@crm/core` pure (injected `dbStore` only; no `Math.random`/IO).
- Extract one step-type at a time, rebuilding `@crm/core` dist and rerunning the
  targeted suites between extractions.

## Test Strategy

- Regression: 410/410 — `cd packages/testing && npx vitest run` (against rebuilt
  `@crm/core` dist; tests resolve packages via `dist/`, so rebuild before testing).
- Per-step coverage already exists and pins each branch:
  `marketing-sequence-{branching,ab-testing,wait-conditions,snooze,throttle,
  task-actions,sms-actions,call-actions,webhook-actions}.test.ts`.

## Rollback

`git restore packages/core/src/domain/sequences/execution.ts`.
