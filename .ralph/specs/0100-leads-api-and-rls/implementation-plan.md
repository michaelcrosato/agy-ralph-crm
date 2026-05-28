# Specification: Lead Operations API & Multi-Tenant RLS Store - Implementation Plan

## Code Generation Sequence

### Step 1: Database Persistent In-Memory RLS Store
Enhance `packages/db/src/index.ts` to implement:
- Dynamic persistent in-memory arrays for all CRM tables.
- `AsyncLocalStorage` tenant context propagation.
- Tenant context setter `withTenant`.
- Expose methods `dbStore.leads`, `dbStore.accounts`, `dbStore.contacts`, `dbStore.opportunities`, `dbStore.auditLogs` with automated RLS enforcement.

### Step 2: Hono JWT Tenant Auth Middleware
Implement `tenantAuth` middleware in `packages/auth/src/index.ts` to intercept header bearer tokens, verify them, and bind them to the request lifecycle.

### Step 3: REST Router Declarations
Update `apps/api/src/index.ts` to:
- Bind `tenantAuth` middleware to all `/api/*` routes.
- Implement `POST /api/leads`, `GET /api/leads`, `GET /api/leads/:id`, and `POST /api/leads/:id/convert`.
- Track updates and write audit logs using `@crm/audit` library functions.

### Step 4: Verification Testing
Create `packages/testing/src/leads-api.test.ts` to fully assert authentication, RLS multi-tenant security blocks, lead operations, lead conversion atomicity, and audit logging.
