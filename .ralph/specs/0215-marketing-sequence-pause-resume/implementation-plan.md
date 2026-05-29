# Specification: Marketing Sequence Pause & Resume API - Implementation Plan

## 1. Phase 1: Core Logic
- Implement `pauseMarketingSequence` and `resumeMarketingSequence` in `packages/core/src/index.ts`.
- In `executePendingSequenceSteps` in `packages/core/src/index.ts`, add a check for `sequence.status === "paused"` to skip step execution.

## 2. Phase 2: Hono Routes
- Mount `/api/sequences/:id/pause` and `/api/sequences/:id/resume` REST endpoints inside `apps/api/src/index.ts`.
- Apply `tenantAuth` middleware to enforce active tenant context and prevent cross-tenant leakage.
- Throw correct `404` errors if a sequence does not exist or tenant mismatch occurs.

## 3. Phase 3: Verification Suite
- Create integration test suite `packages/testing/src/marketing-sequence-pause.test.ts`.
- Verify the following test scenarios:
  1. Pause an active sequence.
  2. Fail to pause an inactive sequence (e.g. draft, archived).
  3. Resume a paused sequence.
  4. Fail to resume an active or draft sequence.
  5. RLS checks: a tenant cannot pause/resume another tenant's sequence.
  6. Background execution check: pending steps are not executed while the sequence is paused, but run successfully once resumed.
- Run `pnpm verify` to validate all typescript, lint, and test checks pass.
