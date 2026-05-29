# Specification: Marketing Sequence Recipient Engagement Scoring - Implementation Plan

## 1. Phase 1: Database Setup
- Modify `packages/db/src/schema.ts` to add the `engagementScore` integer column inside `marketingSequenceMemberships`.
- Modify `packages/db/src/index.ts` to include `engagementScore` in `DBMarketingSequenceMembership` and update `marketingSequenceMemberships` store logic.

## 2. Phase 2: Core Domain Logic
- Add `calculateRecipientEngagementScore` and its input/output types in `packages/core/src/index.ts`.
- Ensure proper exports are exposed and fully compiled.

## 3. Phase 3: REST API Endpoint Integration
- Add the `GET /api/sequences/:id/engagement-scores` secure endpoint inside `apps/api/src/index.ts`.
- Add the `POST /api/sequences/members/:id/recalculate-score` secure endpoint inside `apps/api/src/index.ts` that aggregates events and calls `calculateRecipientEngagementScore`.
- Inside the event tracking handlers (`POST /api/public/emails/track/open/:token`, etc.), add real-time recalculation hooks to fetch the matching `marketingSequenceMemberships` record, recalculate its `engagementScore`, and persist it.

## 4. Phase 4: Integration & RLS Tests
- Write a new integration test suite `packages/testing/src/marketing-sequence-scoring.test.ts` to assert that:
  - Engagement scores compute accurately based on custom weight configurations.
  - Public tracking endpoints trigger real-time updates of the membership's engagement score.
  - Active tenant RLS boundaries are enforced so one tenant cannot view or trigger score recalculations for another.

## 5. Phase 5: Verification Pipeline
- Run `pnpm verify` and `pnpm test` to verify that everything works cleanly and compiles without any errors.
- Commit all changes to Git.
