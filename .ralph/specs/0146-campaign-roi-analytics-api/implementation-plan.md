# Specification: Campaign ROI & Performance Analytics API - Implementation Plan

We will implement this feature in discrete, controlled steps:

## Step 1: Core Engine Implementation
Add the `CampaignROIMetrics` interface and `calculateCampaignROI` helper function to `packages/core/src/index.ts`. Export them properly.

## Step 2: Database Store Helpers (If needed)
Ensure we have finders for campaign members and campaign influences by campaign ID.
Let's see if we need any DB store methods:
- `dbStore.campaignMembers` is already active. Let's make sure it has helper methods or we can just filter in memory or query `findMany()`. Since we have memory stores, calling `findMany()` and filtering by `campaignId` is standard and extremely simple/low-risk.

## Step 3: REST API Endpoint Route
Add `GET /api/campaigns/:id/roi` in `apps/api/src/index.ts`. Use `tenantAuth` to enforce RLS.
Inside the endpoint:
- Validate campaign exists.
- Query and filter members, influences, and won opportunities.
- Calculate and return metrics.

## Step 4: Integration Test Suite
Create `packages/testing/src/campaign-roi.test.ts` to assert:
- Correct computation of ROI with diverse data profiles.
- Strict tenant RLS boundary enforcement.

## Step 5: Verification & Format
- Run `pnpm typecheck` and `pnpm lint`.
- Format and fix errors if any.
- Run `pnpm test` to verify the test suite passes.
