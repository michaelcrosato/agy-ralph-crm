# Specification: Opportunity Teams & Collaborative Roles API - Implementation Plan

## Step 1: Database Schema Modification
Update `packages/db/src/schema.ts` to include the `opportunityTeams` table definition and export it.

## Step 2: Database Store Modification
Update `packages/db/src/index.ts` to:
- Define `DBOpportunityTeamMember` interface.
- Add `opportunityTeams` array stub under `store` object.
- Add `dbStore.opportunityTeams` operations:
  - `findMany()`
  - `findForOpportunity(opportunityId: string)`
  - `insert(member)`
  - `addOrUpdateMember(opportunityId, userId, role)`
  - `removeMember(opportunityId, userId)`
- Add `store.opportunityTeams = []` inside the `reset()` function.

## Step 3: Core Validation Implementation
Update `packages/core/src/index.ts` to include:
- `SUPPORTED_OPPORTUNITY_TEAM_ROLES` constant.
- `validateOpportunityTeamMember()` pure helper function.

## Step 4: Routing Integration
Update Hono API endpoints inside `apps/api/src/index.ts` to expose GET, POST, and DELETE endpoints under `/api/opportunities/:id/team`. Ensure active tenant context and audit logs are recorded.

## Step 5: Test Verification
Create `packages/testing/src/opportunity-teams.test.ts` to assert team membership operations, role validation, RLS boundary protection, and audit trailing.
