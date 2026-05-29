# Specification: Marketing Sequence Suppression Lists & Exclusion Rules Engine - Implementation Plan

## 1. Step-by-Step Code Generation Sequence

### Step 1: Database Schema & Seed Data
- Modify `packages/db/src/schema.ts` to append table definitions:
  - `marketingSequenceSuppressions`
  - `marketingSequenceExclusions`
- Add exports for new schema tables in `packages/db/src/index.ts`.
- Ensure schema exports map correctly in core db interfaces.

### Step 2: Core Business Logic Enhancement
- Update `packages/core/src/index.ts` to add types `CoreSequenceSuppression` and `CoreSequenceExclusion`.
- Implement function `isRecordSuppressedOrExcluded` containing the business logic for checks.
- Modify `enrollInSequence` to execute the suppression check prior to enrollment. If matched, insert the membership with status `"suppressed"`.
- Modify step execution loop (`executePendingSequenceSteps` or background triggers) to evaluate suppression prior to executing email templates. If a match is found, bypass and update status to `"suppressed"`.

### Step 3: Hono REST API Routes
- Append new endpoints to `apps/api/src/index.ts` under active tenant RLS:
  - `GET /api/sequences/suppressions`
  - `POST /api/sequences/suppressions`
  - `DELETE /api/sequences/suppressions/:id`
  - `GET /api/sequences/:id/exclusions`
  - `POST /api/sequences/:id/exclusions`
  - `DELETE /api/sequences/:id/exclusions/:exclusionId`

### Step 4: Integration & RLS Isolation Tests
- Generate a Vitest file `packages/testing/src/marketing-sequence-suppressions.test.ts`.
- Assert:
  - Globals: suppression lists correctly intercept lead/contact enrollment and bypass email delivery.
  - Domain Rules: domain-based exclusions match on "@domain" and intercept memberships.
  - Segments: contact in dynamic excluded segment is correctly blocked.
  - Tenant RLS: verify a query under Org A context cannot access Org B's suppression list or exclusions.
