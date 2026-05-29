# Specification: Marketing Sequence Email Open Analytics - Implementation Plan

## 1. Phase 1: Database Setup
- Modify `packages/db/src/schema.ts` to add the `emailOpenEvents` table.
- Modify `packages/db/src/index.ts` to add `DBEmailOpenEvent` type definition, update the in-memory `store`, implement active tenant RLS filters inside `dbStore.emailOpenEvents`, and handle cleanups in `clear()`.

## 2. Phase 2: Core Domain Logic
- Add `calculateOpenAnalytics` utility, including its parameters and output type interfaces, in `packages/core/src/index.ts`.
- Ensure clean exports of these methods.

## 3. Phase 3: REST API Endpoint Integration
- Mount the public `POST /api/emails/track-open/:token` endpoint inside `apps/api/src/index.ts`.
- Mount the tenant-protected `GET /api/sequences/:id/opens-analytics` endpoint inside `apps/api/src/index.ts`.

## 4. Phase 4: Integration Tests
- Create `packages/testing/src/marketing-sequence-open-analytics.test.ts` implementing a solid integration test suite.
- Write tests confirming:
  - Open tracking updates the tracker counts.
  - User Agent string is parsed correctly into the correct device categories (mobile, tablet, desktop).
  - Metrics compute total opens, unique opens, device distributions, and step-level rates.
  - Active tenant RLS boundaries prevent leaking open event data across tenants.

## 5. Phase 5: Verification Pipeline
- Run `pnpm verify` at the workspace root to ensure type safety, lint guidelines, and vitest suites all pass.
- Commit all changes to Git.
