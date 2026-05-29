# Specification: Marketing Sequence Email Open Analytics - Brief

## 1. Functional Objective
To enhance recipient tracking and optimize campaign delivery timing, this feature introduces **Task 0204: Marketing Sequence Email Granular Open Events Logging & Open Analytics**.
While the system currently tracks a simple open count, this feature adds granular logging of email open events (including IP, user agent, and device type auto-detection), plus sequence-level open analytics.
This feature enables the CRM to:
1. Log granular email open events with automated device type parsing (desktop, mobile, tablet).
2. Calculate unique open counts, total opens, and device type distributions for a sequence.
3. Expose a secure, tenant-isolated REST endpoint `GET /api/sequences/:id/opens-analytics`.
4. Expose a public REST endpoint `POST /api/emails/track-open/:token` to record opens.

## 2. Technical Scope
- **Database Schema**:
  - Add `emailOpenEvents` table and in-memory store in `packages/db`.
- **Core Engine Integration**:
  - Implement a new analytical utility function `calculateOpenAnalytics` in `packages/core`.
- **Hono REST Endpoints**:
  - Expose `GET /api/sequences/:id/opens-analytics` (tenant-protected).
  - Expose `POST /api/emails/track-open/:token` (public).
- **Tests**:
  - Write integration tests in `packages/testing/src/marketing-sequence-open-analytics.test.ts` to assert correct logging, device parsing, aggregation arithmetic, and RLS tenant isolation.
