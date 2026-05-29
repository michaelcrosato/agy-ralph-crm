# Spec 0140: Opportunity Stage Gates & Validation Rules Implementation Plan

## Phase 1: Database & Stores
1. **Schema Update**: Define `opportunityStageGates` table schema in `packages/db/src/schema.ts`.
2. **dbStore Additions**: Integrate DBOpportunityStageGate interface and CRUD repository operations under `packages/db/src/index.ts`. Ensure active tenant RLS context assertion checks.
3. **Verify DB Compilation**: Ensure `pnpm --filter @crm/db build` completes successfully.

## Phase 2: Core Domain Update
1. **Core Utilities**: Add `validateOpportunityStageGate` and `StageGateRule` utilities to `packages/core/src/index.ts`.
2. **Verify Core Compilation**: Ensure `pnpm --filter @crm/core build` completes successfully.

## Phase 3: REST API & Routing
1. **Hono Route Definition**: Implement stage gate query (`GET`) and creation/mutation (`POST`) endpoints under `apps/api/src/index.ts`.
2. **Opportunities Routing Update**: Update opportunity updates (`PATCH`) route under `apps/api/src/index.ts` to check if `stage` changes. If so, fetch active stage gates, construct a merged payload, run validation, and return an HTTP `400 Bad Request` with errors if validation fails.
3. **Verify API Compilation**: Ensure `pnpm --filter api build` completes successfully.

## Phase 4: Verification & Integration Tests
1. **Integration Test Suite**: Write `packages/testing/src/stage-gates.test.ts` asserting:
   - Stage gate configuration and retrieval under active tenant RLS isolation.
   - Stage transitions blocking and throwing validation errors when conditions are violated.
   - Stage transitions succeeding when all validation conditions are met.
   - Multi-tenant data leakage prevention assertions.
2. **Run Verification Pipelines**: Execute workspace checks via `pnpm verify` to check compilation, formatting, and unit/integration tests.
