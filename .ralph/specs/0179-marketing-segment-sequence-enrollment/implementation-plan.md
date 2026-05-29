# Specification: Marketing Segment Sequence Enrollment API - Implementation Plan

We execute the implementation across the codebase packages sequentially:

## Step 1: Export core logic in `packages/core/src/index.ts`
- Implement `enrollSegmentInSequence` function managing dynamic member resolution, duplicate checking, and sequence enrollment.
- Expose the function in `packages/core/src/index.ts` exports.

## Step 2: Implement REST Endpoints in `apps/api/src/index.ts`
- Import `enrollSegmentInSequence` from `@crm/core`.
- Register `POST /api/segments/:id/enroll-sequence` router action under `tenantAuth`.
- Register `POST /api/sequences/:id/enroll-segment` router action under `tenantAuth`.

## Step 3: Write Integration & RLS Tests
- Create `packages/testing/src/marketing-segment-sequence-enrollment.test.ts`.
- Write tests that verify:
  1. Correct enrollment of multiple matching segment members.
  2. Prevention of duplicate enrollments for already active members.
  3. Strict row-level security (RLS) tenant isolation.

## Step 4: Run Verification Pipeline
- Run `pnpm verify` to run the turbo compilation and biome linter.
- Run `pnpm --filter @crm/testing test -- marketing-segment-sequence-enrollment` to verify vitest passes completely.
