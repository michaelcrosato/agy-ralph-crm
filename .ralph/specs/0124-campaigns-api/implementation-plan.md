# Spec 0124: Campaigns & Campaign Members API Implementation Plan

## Phase 1: Database Schemas & Types
1. **Modify `packages/db/src/schema.ts`**:
   - Define `campaigns` table.
   - Define `campaignMembers` table.
   - Update `opportunities` table with `campaignId: uuid("campaign_id")`.
2. **Modify `packages/db/src/index.ts`**:
   - Add TS interfaces: `DBCampaign`, `DBCampaignMember`.
   - Update `DBOpportunity` interface to include `campaignId: string | null`.
   - Add `campaigns` and `campaignMembers` arrays to mock `store`.
   - Implement `campaigns` and `campaignMembers` accessors/CRUD operations in `dbStore`.
   - Implement `deleteManyForCampaign` / `deleteManyForLead` or similar cleanup if needed.
   - Include arrays cleanup inside `dbStore.clear()`.

## Phase 2: Pure Domain Core Functions
1. **Modify `packages/core/src/index.ts`**:
   - Export `CampaignStatsInput` and `CampaignStatsResult` interfaces.
   - Write pure function `calculateCampaignStats(input: CampaignStatsInput): CampaignStatsResult`.
   - Calculate total members, responded members, response rate, total closed-won opportunity value, and Campaign ROI.

## Phase 3: Hono REST API Integration
1. **Modify `apps/api/src/index.ts`**:
   - Expose endpoints:
     - `POST /api/campaigns`
     - `GET /api/campaigns`
     - `GET /api/campaigns/:id` (which combines campaign record + computed stats from related members & opportunities)
     - `POST /api/campaigns/:id/members`
     - `GET /api/campaigns/:id/members`
   - Fully integrate with standard tenant validation `tenantAuth` middleware to guarantee 100% tenant-isolated processing.

## Phase 4: Verification & Integration Tests
1. **Create `packages/testing/src/campaigns.test.ts`**:
   - Setup two separate mock tenants (Tenant A & Tenant B).
   - Verify Tenant A can create a Campaign and register Lead/Contact members.
   - Verify Tenant B cannot access Tenant A's campaign or members (assert RLS boundary).
   - Create opportunities linked to Campaign A, close-won some of them, and assert that the stats endpoint reports the correct ROI and closed-won revenue amount.
   - Validate using `pnpm verify`.
