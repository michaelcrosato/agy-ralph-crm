# Spec 0128: Campaign Influence API Implementation Plan

## Step 1: Database Schema Definitions
- Edit `packages/db/src/schema.ts` to add the `campaignInfluence` table definition.
- Edit `packages/db/src/index.ts` to add the `DBCampaignInfluence` type, store `campaignInfluence` collection, and `dbStore.campaignInfluence` RLS store mappings (CRUD: findMany, findOne, insert, delete).

## Step 2: Core Domain Logic
- Edit `packages/core/src/index.ts` to implement `calculateCampaignRevenueShare` and `validateInfluencePercentageTotal` helper functions, along with their TypeScript interfaces.

## Step 3: Hono REST API Routes
- Edit `apps/api/src/index.ts` to register:
  - `GET /api/opportunities/:id/campaign-influence`
  - `POST /api/opportunities/:id/campaign-influence`
  - `DELETE /api/opportunities/:id/campaign-influence/:influenceId`
  - `GET /api/campaigns/:id/attribution`
- Integrate audit logging (`dbStore.auditLogs.insert`) and webhook dispatching on campaign influence mutations.

## Step 4: Verification and Integration Tests
- Write a comprehensive integration test file `packages/testing/src/campaign-influence.test.ts` to assert:
  - Percentage allocations cannot exceed 100%.
  - Correct revenue share calculation.
  - Strict Row-Level Security (cross-tenant queries are blocked).
  - Outbound webhook events dispatch correctly.
  - Audit trail logs are cleanly generated.
- Run `pnpm verify` to check workspace compilation, lint checks, and test passes.
