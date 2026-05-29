# Specification: Marketing Sequence Recipient Engagement Scoring - Brief

## 1. Functional Objective
To enable modern enterprise marketing teams to quantify and score recipient interest and intent, this feature introduces **Task 0208: Marketing Sequence Recipient Engagement Scoring Engine**.
While the system currently tracks opens, clicks, replies, bounces, and read-time classification statistics (Task 0207), it does not compile these interaction metrics into a unified, actionable engagement score for each sequence member.

This feature enables the CRM to:
1. Dynamically calculate a composite `engagementScore` for each sequence member based on all their tracking activities (opens, clicks, replies, read times, and bounces/complaints).
2. Store the calculated score as an `engagementScore` attribute directly on the `marketingSequenceMemberships` record.
3. Automatically update the recipient's `engagementScore` whenever a new tracking event (open, click, reply, read time, bounce, complaint, or unsubscribe) is registered.
4. Expose a secure, tenant-isolated REST endpoint `GET /api/sequences/:id/engagement-scores` that returns sequence members and their scores.
5. Provide a secure, tenant-isolated REST endpoint `POST /api/sequences/members/:id/recalculate-score` to manually trigger an engagement score recalculation.

## 2. Technical Scope
- **Database Schema**:
  - Update the `marketingSequenceMemberships` table/store inside `packages/db` to add the `engagementScore` integer column (default `0`).
- **Core Engine Integration**:
  - Implement a new core domain utility `calculateRecipientEngagementScore` in `packages/core`.
  - Export the utility and integrate it with standard schemas and types.
- **REST Endpoints**:
  - Expose `GET /api/sequences/:id/engagement-scores` under `apps/api` (tenant-protected).
  - Expose `POST /api/sequences/members/:id/recalculate-score` under `apps/api` (tenant-protected).
  - Ensure all event tracking routes under `POST /api/public/emails/track/*` automatically recalculate and update the member's engagement score.
- **Tests**:
  - Write comprehensive integration tests in `packages/testing/src/marketing-sequence-scoring.test.ts` asserting score calculation correctness, event triggers, and strict active tenant RLS isolation boundaries.
