# Specification: Marketing Sequence Email Granular Bounce & Spam Complaint Events & Bounce Analytics - Brief

## 1. Functional Objective
To enhance recipient tracking and protect sender domain reputation, this feature introduces **Task 0206: Marketing Sequence Email Granular Bounce & Spam Complaint Events & Bounce Analytics**.
While the system currently handles bounces and complaints by creating general suppressions, this feature adds granular logging of email bounce and complaint events (including event type, bounce classification, and reason) plus sequence-level bounce analytics.
This feature enables the CRM to:
1. Log granular email bounce and complaint events with automated or explicit classification (`hard`, `soft`, `spam_complaint`).
2. Calculate total bounces, total complaints, unique bounced/complained recipients, overall bounce/complaint rate, and classification distributions for a sequence.
3. Expose a secure, tenant-isolated REST endpoint `GET /api/sequences/:id/bounces-analytics`.
4. Expose a public REST endpoint `POST /api/public/emails/track/bounce/:token` updated to record these granular bounce and complaint events.

## 2. Technical Scope
- **Database Schema**:
  - Add `emailBounceEvents` table and in-memory store in `packages/db`.
  - Update `emailTrackers` table to add `bounceCount` and `lastBouncedAt`.
- **Core Engine Integration**:
  - Implement a new analytical utility function `calculateBounceAnalytics` in `packages/core`.
  - Update `handleEmailDeliveryEvent` to log granular bounce/complaint events when triggered.
- **Hono REST Endpoints**:
  - Expose `GET /api/sequences/:id/bounces-analytics` (tenant-protected).
  - Expose `POST /api/public/emails/track/bounce/:token` to accept dynamic bounce/complaint details in the body (`eventType`, `bounceType`, `bounceReason`) and persist them, suppress the recipient, and mark memberships as exited.
- **Tests**:
  - Write integration tests in `packages/testing/src/marketing-sequence-bounce-analytics.test.ts` to assert correct logging, bounce type categorization, analytics aggregation, and active tenant RLS isolation.
