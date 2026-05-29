# Specification: Marketing Sequence Email Reply Analytics - Implementation Plan

## 1. Phase 1: Database Setup
- Modify `packages/db/src/schema.ts` to add the `emailReplyEvents` table.
- Modify `packages/db/src/index.ts` to add `DBEmailReplyEvent` type definition, update the in-memory `store`, implement active tenant RLS filters inside `dbStore.emailReplyEvents`, and handle cleanups in `clear()`.

## 2. Phase 2: Core Domain Logic
- Add `calculateReplyAnalytics` utility, including its parameters and output type interfaces, in `packages/core/src/index.ts`.
- Ensure clean exports of these methods.
- Update `processSequenceEmailReply` in `packages/core/src/index.ts` to accept optional `replyBody` and `senderEmail` to save granular reply events, parsing sentiment keywords.

## 3. Phase 3: REST API Endpoint Integration
- Update the public `POST /api/public/emails/track/reply/:token` endpoint inside `apps/api/src/index.ts` to log reply events.
- Mount the tenant-protected `GET /api/sequences/:id/replies-analytics` endpoint inside `apps/api/src/index.ts`.

## 4. Phase 4: Integration Tests
- Create `packages/testing/src/marketing-sequence-reply-analytics.test.ts` implementing a solid integration test suite.
- Write tests confirming:
  - Reply tracking updates the tracker counts and logs granular reply events.
  - Sentiment is categorized correctly (positive, negative, neutral) based on keywords.
  - Metrics compute total replies, unique replies, sentiment distributions, and step-level rates.
  - Active tenant RLS boundaries prevent leaking reply event data across tenants.

## 5. Phase 5: Verification Pipeline
- Run `pnpm verify` at the workspace root to ensure type safety, lint guidelines, and vitest suites all pass.
- Commit all changes to Git.
