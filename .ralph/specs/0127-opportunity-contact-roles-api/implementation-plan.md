# Spec 0127: Opportunity Contact Roles API Implementation Plan

## Phase 1: Database and Core Function Scaffolding

### Step 1: Update DB Package (`packages/db/src/index.ts`)
* Define `DBOpportunityContactRole` interface.
* Add `opportunityContactRoles` array to the global in-memory `store` object.
* Add `opportunityContactRoles` field and methods (`findMany`, `findForOpportunity`, `findOne`, `insert`, `update`, `delete`) to the `dbStore` object.
* Update the `clear` function in `dbStore` to reset `store.opportunityContactRoles = []`.

### Step 2: Implement Core Functions (`packages/core/src/index.ts`)
* Export `DBOpportunityContactRole` interface.
* Implement `setPrimaryOpportunityContactRole` pure mapper function to enforce the single-primary invariant.
* Export the new type and function in `packages/core/src/index.ts`.

## Phase 2: REST API Integration

### Step 3: Integrate routes in Hono Engine (`apps/api/src/index.ts`)
* Map standard CRUD endpoints under Hono `/api/opportunities/:id/contact-roles`:
  - `GET /api/opportunities/:id/contact-roles`: Retrieve roles.
  - `POST /api/opportunities/:id/contact-roles`: Add a role.
  - `PUT /api/opportunities/:id/contact-roles/:roleId`: Update a role.
  - `DELETE /api/opportunities/:id/contact-roles/:roleId`: Remove a role.
* Endpoints must:
  - Enforce `tenantAuth` middleware context.
  - Validate referential integrity (opportunity and contact exist).
  - Handle single primary enforcement (demoting existing primary contact roles).
  - Generate corresponding audit log entries.
  - Call outbound webhook dispatcher for tracking events (`opportunity.contact_role.created`, `opportunity.contact_role.updated`, `opportunity.contact_role.deleted`).

## Phase 3: Verification & Tests

### Step 4: Write Integration Tests (`packages/testing/src/opportunity-contact-roles.test.ts`)
* Write extensive test cases verifying:
  - Basic CRUD operation flows.
  - Single primary contact role enforcement.
  - RLS boundaries (Tenant A cannot access or mutate Tenant B's contact roles).
  - Referential integrity errors (non-existent contact or opportunity).
  - Correct audit trail logs and webhook dispatches.
* Verify entire workspace typechecks, lint checks, and test checks pass using `pnpm verify`.
