# Specification: Marketing Sequence Email Granular Bounce & Spam Complaint Events & Bounce Analytics - Implementation Plan

## 1. Phase 1: Database Setup
- Modify `packages/db/src/schema.ts` to add the `emailBounceEvents` table and update `emailTrackers` to add `bounceCount` and `lastBouncedAt`.
- Modify `packages/db/src/index.ts` to add `DBEmailBounceEvent` type definition, update `DBEmailTracker` interface and store operations (`insert`, `update`, `updatePublic`), implement active tenant RLS filters inside `dbStore.emailBounceEvents`, and handle cleanups in `clear()`.

## 2. Phase 2: Core Domain Logic
- Add `calculateBounceAnalytics` utility, including its parameters and output type interfaces, in `packages/core/src/index.ts`.
- Ensure clean exports of these methods.
- Update `handleEmailDeliveryEvent` in `packages/core/src/index.ts` to log granular bounce and spam complaint events to `emailBounceEvents` store.

## 3. Phase 3: REST API Endpoint Integration
- Mount the public `POST /api/public/emails/track/bounce/:token` endpoint inside `apps/api/src/index.ts` to process and log bounce/complaint events.
- Mount the tenant-protected `GET /api/sequences/:id/bounces-analytics` endpoint inside `apps/api/src/index.ts`.

## 4. Phase 4: Integration Tests
- Create `packages/testing/src/marketing-sequence-bounce-analytics.test.ts` implementing a solid integration test suite.
- Write tests confirming:
  - Bounce/complaint tracking updates tracker counts, exits memberships, creates suppression rules, and logs granular bounce/complaint events.
  - Metrics compute total bounces, total complaints, unique bounced recipients, bounce rates, and step-level rates.
  - Active tenant RLS boundaries prevent leaking bounce data across tenants.

## 5. Phase 5: Verification Pipeline
- Run `pnpm verify` at the workspace root to ensure type safety, lint guidelines, and vitest suites all pass.
- Commit all changes to Git.
