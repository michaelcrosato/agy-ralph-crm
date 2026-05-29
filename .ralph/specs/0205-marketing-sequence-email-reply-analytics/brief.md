# Specification: Marketing Sequence Email Reply Analytics - Brief

## 1. Functional Objective
To enhance tracking of sequence performance and recipient interactions, this feature introduces **Task 0205: Marketing Sequence Email Granular Reply Events & Reply Analytics**.
While the system currently tracks a simple reply count on the tracker, this feature adds granular logging of email reply events (including reply sender email, reply body/preview, and sentiment analysis / categorization), plus sequence-level reply analytics.
This feature enables the CRM to:
1. Log granular email reply events containing the reply sender, received timestamp, optional reply body/preview, and sentiment (positive, neutral, negative).
2. Calculate unique reply counts, total replies, reply rate, and sentiment distribution for a sequence.
3. Expose a secure, tenant-isolated REST endpoint `GET /api/sequences/:id/replies-analytics`.
4. Expose a public REST endpoint `POST /api/public/emails/track/reply/:token` updated to record these granular reply events.

## 2. Technical Scope
- **Database Schema**:
  - Add `emailReplyEvents` table and in-memory store in `packages/db`.
- **Core Engine Integration**:
  - Implement a new analytical utility function `calculateReplyAnalytics` in `packages/core`.
  - Update `processSequenceEmailReply` to log reply events with simulated sentiment categorization.
- **Hono REST Endpoints**:
  - Expose `GET /api/sequences/:id/replies-analytics` (tenant-protected).
  - Update `POST /api/public/emails/track/reply/:token` to accept dynamic reply details in the body (e.g. `replyBody`, `senderEmail`) and persist them.
- **Tests**:
  - Write integration tests in `packages/testing/src/marketing-sequence-reply-analytics.test.ts` to assert correct logging, sentiment parsing, aggregation arithmetic, and RLS tenant isolation.
