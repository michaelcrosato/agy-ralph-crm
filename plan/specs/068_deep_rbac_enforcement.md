# Spec 068 — Deep RBAC (Role-Based Access Control) Enforcement Engine

## Description & Impact

Currently, the multi-tenant CRM parses a session token containing a `permissionsMask` and stores it inside `TenantContext`, but no route or store actively checks or enforces this mask. Any authenticated tenant user has complete access to CRUD operations, custom objects, and administrative actions, which represents an architectural security vulnerability.

This specification establishes a robust and high-performance Role-Based Access Control (RBAC) enforcement engine across the core relational API surface:
- Define standard permission bitmask constants in `packages/auth/src/index.ts`.
- Create a Hono middleware `requirePermission(required: number)` inside `apps/api/src/middleware/rbac.ts`.
- Chain `requirePermission` on core resource routes (`accounts`, `contacts`, `leads`, `opportunities`, `custom`, `admin`).
- Write comprehensive integration tests in `packages/testing/src/rbac.test.ts` verifying that unauthorized read, write, delete, metadata, and admin requests are rejected with a `403 Forbidden` response.

**Impact:** Satisfies enterprise GDPR, SOC2 compliance, and PII protection requirements by enforcing granular functional access controls across the multi-tenant boundary.

## Definition of Done

- [ ] Declare the `Permission` enum and `hasPermission` helper in `packages/auth/src/index.ts`.
- [ ] Create `apps/api/src/middleware/rbac.ts` exposing `requirePermission` middleware.
- [ ] Wire permissions checks onto:
  - `GET` routes (require `Permission.READ_RECORDS` / `1`)
  - `POST` / `PATCH` / `PUT` routes (require `Permission.WRITE_RECORDS` / `2`)
  - `DELETE` routes (require `Permission.DELETE_RECORDS` / `4`)
  - `/api/admin/*` and db migration actions (require `Permission.MANAGE_USERS` / `8` or `Permission.MANAGE_METADATA` / `16`)
  - `/api/custom/*` custom objects definition endpoints (require `Permission.MANAGE_METADATA` / `16`)
- [ ] Add integration suite `packages/testing/src/rbac.test.ts` verifying that:
  - Token with `permissionsMask: 1` (READ_RECORDS) can fetch records but cannot POST/PATCH/DELETE (403 Forbidden).
  - Token with `permissionsMask: 2` (WRITE_RECORDS) can write records but cannot GET (403 Forbidden).
  - Token with `permissionsMask: 0` cannot access any endpoint (403 Forbidden).
  - Token with standard CRUD `permissionsMask: 7` cannot hit admin seeding/migrations.
- [ ] Run `pnpm verify` and `pnpm test` successfully (all 535+ tests must pass).

## Approach

### Files to modify or create
- `packages/auth/src/index.ts`
- `apps/api/src/middleware/rbac.ts`
- `apps/api/src/routes/accounts.ts`
- `apps/api/src/routes/contacts.ts`
- `apps/api/src/routes/leads/crud.ts`
- `apps/api/src/routes/opportunities/crud.ts`
- `apps/api/src/routes/custom.ts`
- `apps/api/src/routes/admin.ts`
- `packages/testing/src/rbac.test.ts`

## Test Strategy
- Assert correct 403 HTTP status code returned for all insufficient permission configurations.
- Ensure that existing integration tests (which default to `permissionsMask: 7` or `15`) continue to pass without regression.
