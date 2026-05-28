# Specification: Activities & Chronological Task Timelines REST API - Implementation Plan

## Code Generation Sequence

### Step 1: Database Extensions
Add activity type interfaces (`DBActivity` and `DBActivityLink`) and database store operations (`dbStore.activities` and `dbStore.activityLinks`) to `packages/db/src/index.ts`.

### Step 2: API Route Implementations
Implement activities REST routes inside `apps/api/src/index.ts`:
- `POST /api/activities` (with child link insertions)
- `GET /api/activities/:id`
- `GET /api/activities/timeline/:targetType/:targetId` (sorting by `createdAt` desc)

### Step 3: Test Verification
Create integration test file `packages/testing/src/activities-api.test.ts` to test activity creation, linkage, and timeline sorting order.

### Step 4: Execution check
Run full verification suite: Biome formatter, compiler check, and vitest run.
