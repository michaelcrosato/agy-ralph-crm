# Spec 0133: Contact Hierarchies & Organizational Org Charts Brief

## Objective
Introduce contact hierarchy management to the CRM Core. Within customer accounts, contacts operate in structured reporting hierarchies (e.g., an individual contributor reports to a manager, who reports to a director, who reports to the VP). Tracking these reporting lines is essential for understanding the account's internal power map, key decision-makers, and organization charts.

This feature enables linking contacts in reporting structures via a self-referencing relationship, implements core business validations to prevent circular reporting relationships, and builds a contact hierarchy tree query engine under active tenant Row-Level Security (RLS) isolation.

## Scope
* **Database & Store Actions (`packages/db`)**:
  - Add the `reportsToId` field to the `contacts` table in `packages/db/src/schema.ts` as a self-referencing foreign key.
  - Expose helper store methods to query direct reports, parent reporting chains, and retrieve all contacts under active tenant RLS isolation.
* **Core Business Logic (`packages/core`)**:
  - Implement a circular dependency check utility `detectCircularContactRelation` to prevent reporting loops (e.g., Contact A cannot report to Contact B if Contact B is already direct or indirect report of Contact A).
* **REST API Endpoints (`apps/api`)**:
  - `GET /api/contacts/:id/hierarchy`: Retrieve parent reporting path and immediate direct reports of a specific contact.
  - `PATCH /api/contacts/:id`: Validate and prevent setting a `reportsToId` that creates circular references.
* **Audit Trail & Webhooks**:
  - Log audit trail entries when a contact's manager relation is updated or removed.
  - Dispatch outbound webhook events (`contact.hierarchy_updated`) when a reporting relation changes.
* **Row-Level Security**:
  - Verify that all hierarchy queries, updates, and traversals strictly adhere to tenant isolation context, ensuring no cross-tenant hierarchy leaks.
