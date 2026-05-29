# Specification: E-Signature Integration & Document Signing API - Implementation Plan

## 1. Database Persistence Layer
1. Add `esignatureRequests` table schema to `packages/db/src/schema.ts`.
2. Add `DBEsignatureRequest` type, store collection `esignatureRequests: [] as DBEsignatureRequest[]`, and CRUD store methods under `dbStore.esignatureRequests` in `packages/db/src/index.ts`. Ensure active tenant `orgId` check is enforced for both read and write queries.
3. Export `esignatureRequests` from the schema.

## 2. Core Business Logic
1. Implement `processESignatureTransition` in `packages/core/src/index.ts` to enforce the E-Signature request state transitions.
2. Export the function from `packages/core/src/index.ts`.

## 3. API Layer
1. Add REST API endpoints to `apps/api/src/index.ts`:
   - `POST /api/sales/esignature/requests`
   - `GET /api/sales/esignature/requests`
   - `POST /api/sales/esignature/simulate`
2. Ensure endpoints use the `tenantAuth` middleware to propagate and enforce tenant contexts.
3. Hook simulation endpoint into the pure state machine validation and log audit logs whenever a document is viewed, signed, or declined.

## 4. Integration Tests
1. Create `packages/testing/src/esignature.test.ts`.
2. Write integration tests checking:
   - Request creation (CRUD) and relation constraints.
   - Strict state transition rules (simulation).
   - Tenant RLS isolation assertions.
