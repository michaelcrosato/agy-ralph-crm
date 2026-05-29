# Spec 0130: Account Hierarchy & Consolidated Opportunity Rollups Requirements

## 1. Functional Requirements

### Database Schema Expansion
* **R1.1**: The `accounts` table in `packages/db/src/schema.ts` must include a nullable `parentAccountId` field referencing `accounts.id` with `onDelete: "set null"`.
* **R1.2**: Tenant isolation must be maintained: the `parentAccountId` must only point to an account belonging to the same `orgId` tenant context.

### Business Logic Core (`packages/core`)
* **R2.1**: **Circular Dependency Check**: Implement a function `detectCircularAccountRelation(accountsList: { id: string; parentAccountId: string | null }[], targetId: string, proposedParentId: string): boolean`. This must return `true` if setting `proposedParentId` as the parent of `targetId` would introduce a cycle.
* **R2.2**: **Consolidated Opportunity Rollup**: Implement a function `rollupHierarchyPipeline(accounts: { id: string; parentAccountId: string | null }[], opportunities: { accountId: string | null; stage: string; amount: string | null }[], rootAccountId: string): { activePipeline: string; closedWonPipeline: string }`.
  - `activePipeline` is the sum of opportunity amounts for stage NOT IN `"Closed Won"`, `"Closed Lost"`.
  - `closedWonPipeline` is the sum of opportunity amounts for stage EQUALS `"Closed Won"`.
  - All amounts must be calculated as decimals and returned as formatted strings to 2 decimal places.

### Store Engine Expansion (`packages/db`)
* **R3.1**: The `accounts` store in `packages/db/src/index.ts` must support CRUD and fetch hierarchical structures (e.g. finding children, finding parent chain).

### REST API Endpoints (`apps/api`)
* **R4.1**: **GET `/api/accounts/:id/hierarchy`**:
  - Verify account ownership.
  - Return `parentPath` (array of parent accounts up to the root) and `children` (immediate child accounts of the target account).
* **R4.2**: **GET `/api/accounts/:id/consolidated-pipeline`**:
  - Retrieve total pipeline metrics aggregated across the target account and all its recursive descendants.
* **R4.3**: **PATCH `/api/accounts/:id`**:
  - Enforce validation using `detectCircularAccountRelation` when `parentAccountId` is updated. Reject with status `400` if a circular reference would be introduced.

### Audit Ledger & Webhooks
* **R5.1**: Log audit trails for hierarchy updates (recording parent changes) and fire webhook `account.hierarchy_updated` with `accountId`, `oldParentId`, and `newParentId`.

## 2. Non-Functional & Security Requirements

* **S1.1**: **No Cross-Tenant Contamination**: If Account A belongs to Tenant 1 and Account B belongs to Tenant 2, trying to set Account B as parent of Account A must be prevented at the database/middleware validation layer.
* **S1.2**: All operations must operate within the active `AsyncLocalStorage` tenant context.
* **N1.1**: Hierarchy calculations must handle deep nested trees (up to 10 levels) cleanly without stack overflow errors.
