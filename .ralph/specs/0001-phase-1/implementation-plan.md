# Phase 1: Identity, Tenancy, & Security Foundation - Implementation Plan

## Code Generation Steps

### Step 1: Database Schema Definitions
Create `packages/db/src/schema.ts` defining:
* `organizations`
* `users`
* `memberships`
* `roles`

Export all schemas from `packages/db/src/index.ts`.

### Step 2: RLS Tenant Utility
Implement the `withTenant` wrapper inside `packages/db/src/index.ts` to allow scoped RLS queries.

### Step 3: Session Authentication Engine
Implement basic JWT sign and verification in `packages/auth/src/index.ts`, returning `TenantContext`.

### Step 4: Verification Tests
Create `packages/testing/src/tenant.test.ts` to mock database queries, organizations, and prove that tenants are isolated inside their RLS transactions.

### Step 5: Format & Lint
Run `npx biome check --write .` and `pnpm verify` to close out Phase 1.
