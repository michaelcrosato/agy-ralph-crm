# Specification: Marketing Sequence Email Unsubscribe Reasons - Brief

## 1. Functional Objective
This feature introduces **Task 0201: Marketing Sequence Email Unsubscribe Reasons**.
To improve campaign performance, list hygiene, and recipient satisfaction, this feature enables recording, logging, and analyzing the specific reasons why recipients unsubscribe from marketing email sequences.
When recipients click the unsubscribe link in a marketing email, they can choose from a list of predefined reasons (e.g. frequency, relevance, not_requested, other) and provide additional text feedback. This feedback will be persisted in a secure, tenant-isolated manner.

## 2. Technical Scope
- **Database Schema**:
  - Add `emailUnsubscribes` (`email_unsubscribes`) table in `schema.ts` and `index.ts` under `packages/db`.
  - Columns: `id`, `orgId` (ref organizations), `trackerId` (ref emailTrackers), `reason`, `feedback`, `createdAt`.
- **Hono REST endpoints**:
  - Expose public endpoint `POST /api/public/emails/unsubscribe/:token/reason` to submit an unsubscribe reason.
  - Expose protected endpoint `GET /api/emails/unsubscribes` to retrieve a list of unsubscribe reasons under tenant RLS context.
- **Tests**:
  - Write comprehensive RLS and integration tests in `packages/testing/src/marketing-sequence-unsubscribe-reasons.test.ts`.
