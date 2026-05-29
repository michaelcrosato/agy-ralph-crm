# Specification: Marketing Sequence Domain Throttling & Recipient Frequency Capping - Implementation Plan

## 1. Phase 1: Database & Mock Store Configuration
- Update `packages/db/src/schema.ts` to add the `marketingSequenceCaps` table schema.
- Update `packages/db/src/index.ts`:
  - Define `DBMarketingSequenceCap` interface.
  - Expose `marketingSequenceCaps` store under `dbStore` with `findMany`, `insert`, `update`, `clear` capability.
  - Implement dynamic RLS checking inside `marketingSequenceCaps` CRUD methods (matching other stores in the file).

## 2. Phase 2: Core Worker Engine Refactoring
- Update `executePendingSequenceSteps` inside `packages/core/src/index.ts`:
  - Fetch tenant sequence limits from `dbStore.marketingSequenceCaps`.
  - Resolve recipient profiles to extract emails and domains.
  - Filter historical email activities to count domain sent and recipient sent events within 24 hours/7 days.
  - Implement conditional deferrals, `nextExecutionAt` date calculation, and system audit logs.

## 3. Phase 3: REST API Endpoints Mounting
- Add GET and POST `/api/sequences/settings/caps` routing under tenant context validation inside `apps/api/src/index.ts`.
- Expose input validation checking, returning `400 Bad Request` on invalid payloads.

## 4. Phase 4: Verification Suite Execution
- Build integration test suite `packages/testing/src/marketing-sequence-throttling.test.ts`.
- Verify the entire monorepo compiling, lint checking, and test runs using `pnpm verify`.
