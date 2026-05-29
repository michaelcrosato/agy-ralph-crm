# Spec 0138: Lead Conversion Field Mapping Engine Implementation Plan

## Phase 1: Database & Stores
1. **Drizzle Schema Update**: Add the `leadConversionMappings` table definition to `packages/db/src/schema.ts`.
2. **Database Types & mockStore Operations**: Add types and `leadConversionMappings` repository handlers in `packages/db/src/index.ts`. Ensure RLS context assertion checks.
3. **Verify DB Compilation**: Ensure `pnpm --filter @crm/db build` completes successfully.

## Phase 2: Core Mapping Logic
1. **Core Domain Update**: Add `convertLeadWithMappings` and associated types to `packages/core/src/index.ts`.
2. **Verify Core Compilation**: Ensure `pnpm --filter @crm/core build` completes successfully.

## Phase 3: REST API & Routing
1. **Hono Route Definition**: Implement mappings retrieval (`GET`), creation (`POST`), and deletion (`DELETE`) under `apps/api/src/index.ts`.
2. **Lead Conversion Flow Update**: Update `POST /api/leads/:id/convert` in `apps/api/src/index.ts` to retrieve and apply mapped values.
3. **Verify API Compilation**: Ensure `pnpm --filter api build` completes successfully.

## Phase 4: Verification & Integration Tests
1. **Integration Test Suite**: Write `packages/testing/src/lead-conversion-mappings.test.ts` asserting:
   - Creation, listing, and deletion of mapping configurations under strict active tenant RLS isolation.
   - Successful lead conversion executing with field mapping logic.
   - Multi-tenant data leakage prevention assertions.
2. **Run Verification Pipelines**: Execute workspace checks via `pnpm verify` to check compilation, formatting, and unit/integration tests.
