# Spec 0129: Sales Contracts & Account Renewals Implementation Plan

## Phase 1: Database & Schema Extension
1. Update `packages/db/src/schema.ts` to add the `contracts` schema definition with appropriate references to organizations and accounts.
2. Update `packages/db/src/index.ts` to:
   - Export and define `DBContract` interface.
   - Extend the mock `store` properties to house `contracts` list.
   - Implement tenant-isolated CRUD handlers for `contracts` under `dbStore`.
   - Update `clear()` method to empty `contracts` list between test suites.

## Phase 2: Pure Core Business Logic
1. Add core utility calculations to `packages/core/src/index.ts`:
   - `calculateContractRenewalAmount()`
   - `isContractInRenewalWindow()`
   - `generateRenewalOpportunity()`
2. Export all new methods from `packages/core/src/index.ts`.

## Phase 3: REST API Controllers
1. Import core logic methods and extend endpoints in `apps/api/src/index.ts`.
2. Implement endpoints:
   - `GET /api/accounts/:id/contracts`
   - `POST /api/contracts`
   - `PATCH /api/contracts/:id`
   - `DELETE /api/contracts/:id`
   - `POST /api/contracts/:id/renew`
3. Add audit log logging and trigger custom webhooks on creation, update, and renewals.

## Phase 4: Verification & Integration Testing
1. Create `packages/testing/src/contracts.test.ts` to:
   - Verify basic contract CRUD operations with tenant-isolation.
   - Assert RLS throws errors if a tenant tries to query or renew another tenant's contract.
   - Validate contract expiration window checks and escalations.
   - Confirm contract renewal creates opportunities correctly and logs appropriate audit records/webhooks.
2. Run `pnpm verify` to confirm workspace compiles and tests pass successfully.
