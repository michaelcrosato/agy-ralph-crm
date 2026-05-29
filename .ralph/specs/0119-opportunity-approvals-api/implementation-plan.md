# Specification: Multi-Stage Opportunity Approval Processes - Implementation Plan

We will perform the following contiguous implementation steps to fulfill this specification:

## Step 1: Extend `packages/core/src/index.ts`
1. Export `OpportunityRecord` and the pure utility validation function `validateOpportunityApprovalSubmission`.

## Step 2: Extend `packages/db/src/schema.ts`
1. Define and export `opportunityApprovals` and `opportunityApprovalSteps` tables.

## Step 3: Extend `packages/db/src/index.ts`
1. Add `DBOpportunityApproval` and `DBOpportunityApprovalStep` interface types.
2. Extend the global `store` object to contain `opportunityApprovals` and `opportunityApprovalSteps` arrays.
3. Expose `opportunityApprovals` and `opportunityApprovalSteps` sub-stores within `dbStore` with standard `findMany`, `findOne`, `insert`, and `update` methods.
4. Extend `dbStore.clear()` to purge both approval collections.

## Step 4: Implement REST Routing in `apps/api/src/index.ts`
1. Import `validateOpportunityApprovalSubmission` from `@crm/core`.
2. Register endpoints:
   - `POST /api/opportunities/:id/submit-approval`
   - `POST /api/approvals/:id/decide`
   - `GET /api/opportunities/:id/approvals`
3. Enforce active tenant context verification and RLS isolation in every request handler.

## Step 5: Write Integration & RLS Tests
Create a dedicated test file `packages/testing/src/opportunity-approvals.test.ts` to test:
- Successful approval submission.
- Rejection of closed or zero-amount opportunity submissions.
- Step-by-step approval decision tracking and auto-stage transition to "Closed Won".
- Single step rejection leading to auto-stage transition to "Closed Lost".
- RLS boundaries preventing Tenant B from viewing or approving Tenant A's submissions.
