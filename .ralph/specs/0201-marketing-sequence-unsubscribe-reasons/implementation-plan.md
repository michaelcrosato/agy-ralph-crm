# Specification: Marketing Sequence Email Unsubscribe Reasons - Implementation Plan

## Step 1: Database Schema Modification
- Add `emailUnsubscribes` table definition to the end of `packages/db/src/schema.ts`.
- Declare `DBEmailUnsubscribe` type and add `emailUnsubscribes` array state to the simulated in-memory store in `packages/db/src/index.ts`.
- Expose helpers and standard CRUD simulated methods for `emailUnsubscribes` store inside `packages/db/src/index.ts` to ensure consistent RLS enforcement.

## Step 2: REST API Endpoints Implementation
- Open `apps/api/src/index.ts`.
- Expose the public route:
  - `POST /api/public/emails/unsubscribe/:token/reason`
- Expose the protected management route:
  - `GET /api/emails/unsubscribes` with active tenant RLS middleware validation checks.

## Step 3: Write Integration Tests
- Create `packages/testing/src/marketing-sequence-unsubscribe-reasons.test.ts` matching existing vitest patterns.
- Assert correct logging, validation, retrieval, and strict RLS tenant isolation.

## Step 4: Run Verification Gates
- Execute targeted workspace verification check pipelines.
- Format all code files using Biome.
- Commit all changes cleanly to Git under Task 0201 designation.
