# TICKET012: Deep RBAC (Role-Based Access Control) Enforcement Engine

## Details
- **Status**: completed
- **Priority**: High
- **Goal**: Implement bitmask permissions validation and requirePermission Hono middleware to enforce strict RBAC across core resource routes.
- **Context**: Spec 068 describes the approach to inject required permissions checking gates.

---

## Scope

### In Scope
- Declare `Permission` enum and bitwise validation checks inside `@crm/auth`.
- Build Hono `requirePermission` middleware under `apps/api/src/middleware/rbac.ts`.
- Integrate `requirePermission` checks into:
  - Accounts routing (`apps/api/src/routes/accounts.ts`)
  - Contacts routing (`apps/api/src/routes/contacts.ts`)
  - Leads CRUD routing (`apps/api/src/routes/leads/crud.ts`)
  - Opportunities CRUD routing (`apps/api/src/routes/opportunities/crud.ts`)
  - Custom object routing (`apps/api/src/routes/custom.ts`)
  - Seeding/migration admin routes (`apps/api/src/routes/admin.ts`)
- Author `packages/testing/src/rbac.test.ts` to test functional access control boundaries.
- Pass linter, formatter, typecheck, and all unit/integration test suites.

### Out of Scope
- Modifying standard PostgreSQL table definitions.

---

## Steps to Execute
1. Implement bitwise permissions inside `packages/auth/src/index.ts`.
2. Create middleware file `apps/api/src/middleware/rbac.ts`.
3. Add `requirePermission` checks across `accounts.ts`, `contacts.ts`, `leads/crud.ts`, `opportunities/crud.ts`, `custom.ts`, and `admin.ts`.
4. Implement full test suite `packages/testing/src/rbac.test.ts`.
5. Run workspace checks and verify 100% green.

---

## Acceptance Criteria
- [x] Users with insufficient permissions receive `403 Forbidden` response.
- [x] Users with valid permission bitmask can perform permitted actions successfully.
- [x] All previous tests continue to pass regression-free (since they use `permissionsMask: 7` or `15`).
- [x] Biome checks and typescript build are entirely green.
