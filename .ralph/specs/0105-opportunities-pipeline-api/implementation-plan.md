# Specification: Opportunities Pipeline & Stage Management REST API - Implementation Plan

## Code Generation Sequence

### Step 1: Database Store Update Support
Implement an `update` method inside `dbStore.opportunities` in `packages/db/src/index.ts` to allow safe, tenant-isolated mutations to sales opportunities.

### Step 2: REST Opportunities Endpoints
Implement Hono API endpoints inside `apps/api/src/index.ts`:
- `GET /api/opportunities`
- `GET /api/opportunities/:id`
- `POST /api/opportunities`
- `PATCH /api/opportunities/:id` (which integrates `executeWorkflows` on stage transition)

### Step 3: Integration Verification Testing
Create `packages/testing/src/opportunities-api.test.ts` to verify CRUD, tenant isolation, and automated workflow triggers.

### Step 4: Verification Pipeline
Execute build, format/lint check, and all test suites to ensure 100% compliance.
