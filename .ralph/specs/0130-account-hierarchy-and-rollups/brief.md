# Spec 0130: Account Hierarchy & Consolidated Opportunity Rollups Brief

## Objective
Introduce account hierarchy management and consolidated financial rollups to the CRM Core. Large enterprise customers operate with complex organizational structures consisting of parent companies, regional headquarters, and local subsidiaries. To manage these accounts effectively, sales operations require parent-child relationship tracking and consolidated financial reporting that aggregates sales pipeline value across the entire account hierarchy tree.

This feature enables linking accounts in parent-child hierarchies, implements core validations to prevent circular relationships, and builds a consolidated rollup query engine that sums opportunity pipeline values across an entire branch under strict multi-tenant Row-Level Security (RLS) isolation.

## Scope
* **Core Business Logic (`packages/core`)**:
  - Implement recursive traversal to construct parent-child relationship hierarchies.
  - Implement a circular dependency check utility to prevent infinite loops (e.g. Account A cannot set Account B as parent if Account B is already a child of Account A).
  - Implement pipeline aggregation logic that sums active and closed-won opportunity amounts within a hierarchy branch.
* **Database & Store Actions (`packages/db`)**:
  - Add `parentAccountId` to the `accounts` schema definition in `packages/db/src/schema.ts` as a self-referencing foreign key.
  - Expose helper store methods to query child accounts and parent paths.
* **REST API Endpoints (`apps/api`)**:
  - `GET /api/accounts/:id/hierarchy`: Retrieve parent hierarchy path and immediate children of a specific account.
  - `GET /api/accounts/:id/consolidated-pipeline`: Calculate the total consolidated active and closed-won opportunity amounts of an account and all its descendants.
  - `PATCH /api/accounts/:id`: Add validation to prevent setting a parent account that creates circular references.
* **Audit Trail & Webhooks**:
  - Log audit trail entries when an account's parent relation is updated or removed.
  - Dispatch outbound webhook events (`account.hierarchy_updated`) when a parent-child relation changes.
* **Row-Level Security**:
  - Verify that all hierarchy queries, updates, and rollups strictly adhere to the tenant isolation context, ensuring no cross-tenant hierarchy leaks.
