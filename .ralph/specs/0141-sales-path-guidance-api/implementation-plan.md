# Spec 0141: Sales Path Guidance API Implementation Plan

This step-by-step plan outlines the sequence of code modifications across the monorepo packages to implement the Sales Path Guidance API.

## Step 1: Update Database Schema & Store (`packages/db`)
- Edit [packages/db/src/schema.ts](file:///C:/dev/agy-ralph-crm/packages/db/src/schema.ts):
  - Add the `opportunityStageGates` equivalent: `stageGuidance` table schema.
- Edit [packages/db/src/index.ts](file:///C:/dev/agy-ralph-crm/packages/db/src/index.ts):
  - Add the interface `DBStageGuidance`.
  - Add `stageGuidance` to the `store` object.
  - Add `stageGuidance` CRUD operations to the `dbStore` object.
  - Clear `stageGuidance` in `dbStore.clear()`.

## Step 2: Implement Core Guidance Validator (`packages/core`)
- Edit [packages/core/src/index.ts](file:///C:/dev/agy-ralph-crm/packages/core/src/index.ts):
  - Implement `validateStageGuidanceKeyFields` pure logic.

## Step 3: Implement Hono REST Endpoints (`apps/api`)
- Edit [apps/api/src/index.ts](file:///C:/dev/agy-ralph-crm/apps/api/src/index.ts):
  - Import `validateStageGuidanceKeyFields` and `DBStageGuidance`.
  - Implement `GET /api/stage-guidance` and `GET /api/stage-guidance/:objectType/:stage`.
  - Implement `POST /api/stage-guidance`.

## Step 4: Write Comprehensive Integration & RLS Tests (`packages/testing`)
- Create [packages/testing/src/stage-guidance.test.ts](file:///C:/dev/agy-ralph-crm/packages/testing/src/stage-guidance.test.ts):
  - Verify that configurations can be saved and updated under tenant isolation.
  - Assert that Organization A cannot see or modify Organization B's stage guidance.
  - Test validation of key fields for opportunities and leads at specific stages.
  - Assert correct audit logging is produced.

## Step 5: Verify the Monorepo
- Run `pnpm verify` and `pnpm test` to ensure TypeScript compiles cleanly, code complies with Biome's lint constraints, and all test suites pass.
- Commit all changes to git and stop.
