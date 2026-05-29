# Specification: Campaign ROI & Performance Analytics API - Design

## 1. Core Analytics Engine
We will define a core function `calculateCampaignROI` in `packages/core/src/index.ts` that implements the ROI calculation logic:

```typescript
export interface CampaignROIMetrics {
  campaignId: string;
  campaignName: string;
  budgetedCost: number;
  actualCost: number;
  expectedRevenue: number;
  totalMembers: number;
  respondedMembers: number;
  wonOpportunitiesCount: number;
  wonRevenueShareSum: number;
  netValue: number;
  roi: number;
}

export function calculateCampaignROI(params: {
  campaign: { id: string; name: string; budgetedCost: string; actualCost: string; expectedRevenue: string };
  members: { status: string }[];
  influences: { opportunityId: string; revenueShare: string }[];
  wonOpportunityIds: Set<string>;
}): CampaignROIMetrics {
  const budgetedCost = Number(params.campaign.budgetedCost) || 0;
  const actualCost = Number(params.campaign.actualCost) || 0;
  const expectedRevenue = Number(params.campaign.expectedRevenue) || 0;

  const totalMembers = params.members.length;
  const respondedMembers = params.members.filter((m) => m.status === "Responded").length;

  // Filter influences for won opportunities
  const wonInfluences = params.influences.filter((inf) => params.wonOpportunityIds.has(inf.opportunityId));
  
  const wonOpportunitiesCount = new Set(wonInfluences.map((inf) => inf.opportunityId)).size;
  const wonRevenueShareSum = wonInfluences.reduce((acc, inf) => acc + (Number(inf.revenueShare) || 0), 0);

  const netValue = wonRevenueShareSum - actualCost;
  let roi = 0;
  if (actualCost > 0) {
    roi = Math.round((netValue / actualCost) * 100 * 100) / 100;
  }

  return {
    campaignId: params.campaign.id,
    campaignName: params.campaign.name,
    budgetedCost,
    actualCost,
    expectedRevenue,
    totalMembers,
    respondedMembers,
    wonOpportunitiesCount,
    wonRevenueShareSum: Math.round(wonRevenueShareSum * 100) / 100,
    netValue: Math.round(netValue * 100) / 100,
    roi,
  };
}
```

## 2. REST API Routes
In `apps/api/src/index.ts`:
- Define `GET /api/campaigns/:id/roi` protected by `tenantAuth` middleware.
- The route will:
  1. Find the campaign using `dbStore.campaigns.findOne(id)`. If missing, return `404`.
  2. Fetch all `campaignMembers` for this campaign.
  3. Fetch all `campaignInfluence` records for this campaign.
  4. Fetch all opportunities in `Closed Won` stage for the tenant.
  5. Call `calculateCampaignROI` and return `{ success: true, data: metrics }`.
