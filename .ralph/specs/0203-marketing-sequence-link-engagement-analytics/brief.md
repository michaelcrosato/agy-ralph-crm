# Specification: Marketing Sequence Link Engagement Analytics - Brief

## 1. Functional Objective
To optimize email marketing campaigns and understand recipient behavior, this feature introduces **Task 0203: Marketing Sequence Link Engagement Analytics**.
While the CRM already tracks individual email open and click events (Task 0200), marketers need a high-level, aggregated view of link-level engagement across different email steps in their marketing sequences.
This feature enables the CRM to:
1. Aggregate and group email click-through events by sequence, step, and clicked URL.
2. Calculate unique click counts and Click-Through Rate (CTR) percentages for each individual link.
3. Expose a secure, tenant-isolated REST endpoint `/api/sequences/:id/links-analytics`.

## 2. Technical Scope
- **Core Engine Integration**:
  - Implement a new analytical utility function `calculateLinkEngagementAnalytics` in `packages/core`.
- **Hono REST Endpoint**:
  - Expose `GET /api/sequences/:id/links-analytics` protected by tenant context.
- **Tests**:
  - Write integration tests in `packages/testing/src/marketing-sequence-link-engagement.test.ts` checking aggregation calculations and RLS tenant boundaries.
