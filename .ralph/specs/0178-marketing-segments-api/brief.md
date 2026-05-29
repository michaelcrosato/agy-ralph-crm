# Specification: Marketing Segments & Dynamic Lists API - Brief

## 1. Functional Objective
This feature introduces automated **Marketing Segments & Dynamic Lists**. It allows CRM administrators and marketers to define dynamic groups of Leads or Contacts based on criteria filters. Unlike static list assignments, segments automatically recalculate their members dynamically in real time whenever records are queried.

It implements:
1. **Dynamic Segment Definition**: Allowing users to create a segment with criteria filters (e.g. Leads in "New" status, or Contacts belonging to a specific company/domain or custom fields).
2. **Dynamic Member Resolution Engine**: A core execution routine that queries all records of the target object type and filters them against the segment's criteria in real time.
3. **Multi-Tenant RLS isolation**: Every segment configuration and resolved members list is strictly isolated at the tenant organization level.

## 2. Technical Scope
- **Database Schema Expansion**:
  - Add table `marketing_segments` in `packages/db`.
- **Core Engine Mechanics**:
  - Implement a `packages/core` resolver function `resolveSegmentMembers(dbStore, tenantOrgId, segmentId)` evaluating conditions (`equals`, `not_equal`, `contains`, `greater_than`, `less_than`).
- **REST Endpoints**:
  - `POST /api/segments` - Create a new dynamic segment.
  - `GET /api/segments` - List all active segments for the tenant.
  - `GET /api/segments/:id` - Retrieve segment metadata details.
  - `DELETE /api/segments/:id` - Delete a segment.
  - `GET /api/segments/:id/members` - Dynamically resolve and return matching members of the segment under tenant RLS.
- **Verification Gate**:
  - Workspace compilation (`pnpm verify`), and comprehensive RLS/integration test suites in `packages/testing/src/marketing-segments.test.ts`.
