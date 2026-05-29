# Specification: Marketing Sequence Email Read Time Analytics & Scoring - Implementation Plan

## 1. Phase 1: Database Setup
- Modify `packages/db/src/schema.ts` to add the `emailReadTimeEvents` table and update `emailTrackers` to add `totalReadTimeMs` and `lastReadClassification`.
- Modify `packages/db/src/index.ts` to add `DBEmailReadTimeEvent` type definition, update `DBEmailTracker` interface and store operations (`insert`, `update`, `updatePublic`), implement active tenant RLS filters inside `dbStore.emailReadTimeEvents`, and handle cleanups in `clear()`.

## 2. Phase 2: Core Domain Logic
- Add `calculateReadTimeAnalytics` utility, including its parameters and output type interfaces, in `packages/core/src/index.ts`.
- Ensure clean exports of these methods.

## 3. Phase 3: REST API Endpoint Integration
- Mount the public `POST /api/public/emails/track/read-time/:token` endpoint inside `apps/api/src/index.ts` to process and log read time events.
- Mount the tenant-protected `GET /api/sequences/:id/read-time-analytics` endpoint inside `apps/api/src/index.ts`.

## 4. Phase 4: Integration Tests
- Create `packages/testing/src/marketing-sequence-read-time.test.ts` implementing a solid integration test suite.
- Write tests confirming:
  - Read time tracking updates tracker metrics, last classification, and logs granular read classification events correctly.
  - Metrics compute Glance, Skim, and Read totals, average read time, percentages, and step-level rates.
  - Active tenant RLS boundaries prevent leaking read-time data across tenants.

## 5. Phase 5: Verification Pipeline
- Run `pnpm verify` at the workspace root to ensure type safety, lint guidelines, and vitest suites all pass.
- Commit all changes to Git.
