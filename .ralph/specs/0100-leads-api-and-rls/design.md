# Specification: Lead Operations API & Multi-Tenant RLS Store - Design

## Database Storage Architecture
We will enhance `packages/db/src/index.ts` to implement a robust, fully-isolated dynamic in-memory repository store that operates like a production RLS-compliant PostgreSQL server.
- Uses `AsyncLocalStorage` from `node:async_hooks` to propagate the active `orgId` (tenant context) across transaction scopes.
- Every query (`findMany`, `findOne`, `insert`, `update`) automatically resolves the current tenant `orgId` from the storage context.
- If a query attempts to access or mutate a record belonging to another tenant, it throws a strict isolation validation exception.

## Hono API Security Middleware
In `packages/auth/src/index.ts` or in the API app:
- We will export a Hono middleware `tenantAuth` that:
  1. Reads the `Authorization` header.
  2. Verifies the JWT session token using `verifySessionToken`.
  3. Sets the verified `TenantContext` on Hono context `c.set("tenant", context)`.
  4. Binds the context to the database's active `orgId` context using `withTenant`.

## REST API Endpoints
We will define routes under `apps/api/src/index.ts`:
- `POST /api/leads`
  - Body: `{ email: string, company: string, status?: string, custom?: Record<string, unknown> }`
  - Returns: `{ success: true, data: Lead }`
- `GET /api/leads`
  - Returns: `{ success: true, data: Lead[] }` (Filtered automatically by RLS)
- `GET /api/leads/:id`
  - Returns: `{ success: true, data: Lead }`
- `POST /api/leads/:id/convert`
  - Body: `{ opportunityName?: string, opportunityAmount?: string }`
  - Returns: `{ success: true, accountId: string, contactId: string, opportunityId?: string }`
