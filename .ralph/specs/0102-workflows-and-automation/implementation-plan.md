# Specification: Workflow REST API & Event-Triggered Automation - Implementation Plan

## Code Generation Sequence

### Step 1: Database Workflow Store
Add `workflows` table interface and isolated find/insert RLS operations to `dbStore` inside `packages/db/src/index.ts`.

### Step 2: REST Workflow Endpoints
Implement workflow routes inside `apps/api/src/index.ts`:
- `POST /api/workflows` (register new automated rule)
- `GET /api/workflows` (list tenant rules)

### Step 3: Trigger Automation on Conversion
Integrate `executeWorkflows` into the Lead Conversion endpoint in `apps/api/src/index.ts` to automatically fire notifications/webhooks when an opportunity stage transitions.

### Step 4: Verification Testing
Create `packages/testing/src/workflow-api.test.ts` to assert that registered workflow rules trigger successfully when conditions are met and remain locked behind tenant boundaries when another tenant operates.
