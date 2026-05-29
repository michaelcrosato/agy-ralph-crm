# Specification: Marketing Sequence Email Read Time Analytics & Scoring - Brief

## 1. Functional Objective
To gain deeper insights into recipient engagement and content effectiveness, this feature introduces **Task 0207: Marketing Sequence Email Read Time Analytics & Scoring**.
While the system currently tracks opens, clicks, replies, and bounces, it does not measure *how long* a recipient spends reading an email.
This feature enables the CRM to:
1. Log email read-time events publicly with automatic engagement classification based on duration (`glanced` for <2s, `skimmed` for 2s-8s, and `read` for >=8s).
2. Store cumulative read duration metrics (`totalReadTimeMs` and `lastReadClassification`) on the email tracking records.
3. Calculate sequence-level read-time analytics, including glanced, skimmed, and read event counts, average read time, and step-level read-time breakdowns.
4. Expose a secure, tenant-isolated REST endpoint `GET /api/sequences/:id/read-time-analytics`.
5. Expose a public REST endpoint `POST /api/public/emails/track/read-time/:token` to record granular read duration in milliseconds.

## 2. Technical Scope
- **Database Schema**:
  - Add `emailReadTimeEvents` table and in-memory store in `packages/db`.
  - Update `emailTrackers` table to add `totalReadTimeMs` and `lastReadClassification`.
- **Core Engine Integration**:
  - Implement a new analytical utility function `calculateReadTimeAnalytics` in `packages/core`.
  - Update exports and index interfaces.
- **Hono REST Endpoints**:
  - Expose `GET /api/sequences/:id/read-time-analytics` (tenant-protected).
  - Expose `POST /api/public/emails/track/read-time/:token` to accept read-time details in the body (`durationMs`).
- **Tests**:
  - Write integration tests in `packages/testing/src/marketing-sequence-read-time.test.ts` to assert correct logging, classification categorization, analytics aggregation, and active tenant RLS isolation.
