# Specification: Marketing Sequence Unsubscribe Analytics - Brief

## 1. Functional Objective
To improve email list health and sequence content strategies, this feature introduces **Task 0202: Marketing Sequence Unsubscribe Analytics**.
Currently, the CRM logs individual unsubscribe reasons on the `email_unsubscribes` table (Task 0201) but does not provide an aggregated analytical view. Marketers need a consolidated report showing the overall unsubscribe volume, distribution of unsubscribe reasons, and breakdown by individual marketing sequence.
This feature enables the CRM to:
1. Aggregate unsubscribe reasons across a tenant organization.
2. Link unsubscribe events to the corresponding marketing sequences.
3. Expose a secure, tenant-isolated endpoint `/api/unsubscribes/analytics`.

## 2. Technical Scope
- **Core Engine Integration**:
  - Implement a new analytical utility function `calculateUnsubscribeAnalytics` in `packages/core`.
- **Hono REST Endpoint**:
  - Expose `GET /api/unsubscribes/analytics` protected by tenant context.
- **Tests**:
  - Write integration tests in `packages/testing/src/marketing-sequence-unsubscribe-analytics.test.ts` checking aggregation calculations and RLS tenant boundaries.
