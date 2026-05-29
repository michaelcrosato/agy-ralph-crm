# Specification: Marketing Sequence Campaign Automated Re-Enrollment & Frequency Capping Controls - Implementation Plan

This plan outlines the step-by-step sequence of changes required to implement **Task 0190**.

## 1. Step-by-Step Code Modifications

- [ ] **Step 1: Database Schema Modifications**
  - Update `packages/db/src/schema.ts` to include columns `allowReenrollment` and `reenrollmentMinDays` under the `marketingSequences` table.
  - Update `DBMarketingSequence` interface in `packages/db/src/index.ts`.

- [ ] **Step 2: Core Domain Logic Update**
  - Extend the `CoreSequence` interface inside `packages/core/src/index.ts` to support `allowReenrollment?: boolean | null` and `reenrollmentMinDays?: number | null`.
  - Add query logic inside `enrollInSequence` to search for prior memberships using `dbStore.marketingSequenceMemberships.findMany` (if available).
  - Enforce RLS checks and throw appropriate validation errors if active enrollment overlapping occurs, re-enrollment is disabled, or frequency cooldown periods are violated.

- [ ] **Step 3: REST API Controllers Update**
  - Update `app.post("/api/sequences")` and PUT updates in `apps/api/src/index.ts` to extract `allowReenrollment` and `reenrollmentMinDays` from JSON payloads.
  - Wrap the `/enroll` POST handler in a try/catch block returning a `400` status with a structured error when `enrollInSequence` throws.

- [ ] **Step 4: Scaffolding Integration Tests**
  - Create a new Vitest test suite under `packages/testing/src/marketing-sequence-reenrollment.test.ts`.
  - Validate active enrollment blocking, re-enrollment restriction blocking, frequency capping cooldown, and RLS multi-tenant boundary compliance.

## 2. Verification Command Gate
- [ ] Run `pnpm verify` to confirm compilation, linting, formatting, and unit/integration tests all pass cleanly with zero errors.
