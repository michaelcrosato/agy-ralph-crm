# Spec 0137: Opportunity Competitors API Implementation Plan

## Steps to Execute

### Step 1: Implement Schema & Store in `packages/db`
* Open `packages/db/src/schema.ts` and define `opportunityCompetitors` table.
* Open `packages/db/src/index.ts`:
  - Declare `DBOpportunityCompetitor` and `InsertOpportunityCompetitor` types.
  - Add `opportunityCompetitors` array to the in-memory `store` object.
  - Implement full CRUD operations (`findMany`, `findOne`, `insert`, `update`, `delete`) in the `dbStore` helper, checking matching `orgId` (active tenant organization) for secure RLS bounds.
  - Add initialization cleanups for the new store array.

### Step 2: Implement Business Logic in `packages/core`
* Open `packages/core/src/index.ts`.
* Implement `calculateOpportunityCompetitorStats` to aggregate competitor count, statuses, and list of competitor names.
* Export types and function cleanly.

### Step 3: Implement REST Endpoints in `apps/api`
* Open `apps/api/src/index.ts`.
* Implement the REST endpoints under active organization security:
  - `GET /api/opportunities/:id/competitors`
  - `POST /api/opportunities/:id/competitors`
  - `PUT /api/opportunities/:id/competitors/:competitorId`
  - `DELETE /api/opportunities/:id/competitors/:competitorId`
* Record audit logs (`create_competitor`, `update_competitor`, `delete_competitor`) for all mutations.
* Dispatch `competitor.created`, `competitor.updated`, and `competitor.deleted` webhook triggers.

### Step 4: Write Verification & RLS Tests
* Create `packages/testing/src/opportunity-competitors.test.ts`.
* Write thorough tests covering all CRUD endpoints, statistics logic, and active tenant RLS bounds.

### Step 5: Run Verification Pipeline
* Execute workspace verify scripts to ensure everything compiles and test suite passes cleanly.
