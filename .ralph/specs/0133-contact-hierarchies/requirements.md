# Spec 0133: Contact Hierarchies & Organizational Org Charts Requirements

## 1. Functional Requirements

### Database Schema Expansion
* **R1.1**: The `contacts` table in `packages/db/src/schema.ts` must include a nullable `reportsToId` field referencing `contacts.id` with `onDelete: "set null"`.
* **R1.2**: Tenant isolation must be maintained: the `reportsToId` must only point to a contact belonging to the same `orgId` tenant context.

### Business Logic Core (`packages/core`)
* **R2.1**: **Circular Dependency Check**: Implement a function `detectCircularContactRelation(contactsList: { id: string; reportsToId: string | null }[], targetId: string, proposedReportsToId: string): boolean`. This must return `true` if setting `proposedReportsToId` as the manager/reportsTo of `targetId` would introduce a cycle.
  - If `targetId === proposedReportsToId`, it must return `true`.
  - It must traverse upwards from `proposedReportsToId` to check if it ever encounters `targetId`.

### Store Engine Expansion (`packages/db`)
* **R3.1**: The `contacts` store in `packages/db/src/index.ts` must support CRUD and fetching hierarchical structures under active tenant RLS isolation.

### REST API Endpoints (`apps/api`)
* **R4.1**: **GET `/api/contacts/:id/hierarchy`**:
  - Verify contact ownership.
  - Return `parentPath` (array of contact objects representing the manager chain up to the root) and `directReports` (immediate contacts reporting to the target contact).
* **R4.2**: **PATCH `/api/contacts/:id`**:
  - Enforce validation using `detectCircularContactRelation` when `reportsToId` is updated. Reject with status `400` and a clear error message if a circular reference would be introduced.
  - Assert that both contacts belong to the same account or the same organization.

### Audit Ledger & Webhooks
* **R5.1**: Log audit trails for contact hierarchy updates (recording reportsTo changes) and fire webhook `contact.hierarchy_updated` with `contactId`, `oldReportsToId`, and `newReportsToId`.

## 2. Non-Functional & Security Requirements

* **S1.1**: **No Cross-Tenant Contamination**: If Contact A belongs to Tenant 1 and Contact B belongs to Tenant 2, trying to set Contact B as manager of Contact A must be prevented at the database/middleware validation layer.
* **S1.2**: All operations must operate within the active `AsyncLocalStorage` tenant context.
* **N1.1**: Hierarchy calculations must handle nested trees cleanly without stack overflow errors.
