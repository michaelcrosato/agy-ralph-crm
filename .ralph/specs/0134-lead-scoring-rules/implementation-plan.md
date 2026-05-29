# Spec 0134: Lead Scoring Rules Implementation Plan

## Step 1: Schema Updates
- Add `leadScoringRules` table to `packages/db/src/schema.ts`.
- Update `packages/db/src/index.ts` to include:
  - `DBLeadScoringRule` interface.
  - `leadScoringRules` collection in `store`.
  - `dbStore.leadScoringRules` CRUD operations context.

## Step 2: Core Logic Implementation
- Implement the `ScoringRuleInput` interface and pure `calculateLeadScore` function in `packages/core/src/index.ts`.
- Re-export these in `packages/core/src/index.ts`.

## Step 3: API Endpoint Implementation
- In `apps/api/src/index.ts`, implement the four REST routes:
  - `GET /api/lead-scoring-rules`
  - `POST /api/lead-scoring-rules`
  - `GET /api/leads/:id/score`
  - `POST /api/leads/:id/score/recalculate`

## Step 4: Integration and RLS Tests
- Create `packages/testing/src/lead-scoring.test.ts` to test:
  - Rule CRUD and active tenant context enforcement.
  - Verification of criteria evaluating correctly for standard and custom fields.
  - Dynamic score calculations.
  - Persistent recalculation, audit logging, and webhook event dispatching.
  - Strict RLS isolation boundaries verifying cross-tenant security.

## Step 5: Verification Gate
- Run `pnpm verify` to check type safety, linting checks, and test suites.
- Commit all changes to Git.
