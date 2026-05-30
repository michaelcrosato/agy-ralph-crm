import type {
  CampaignROIMetrics,
  CampaignStatsInput,
  CampaignStatsResult,
} from "../../types";

export function calculateCampaignStats(
  input: CampaignStatsInput,
): CampaignStatsResult {
  const totalMembers = input.members.length;
  const respondedMembers = input.members.filter(
    (m) => m.status.toLowerCase() === "responded",
  ).length;
  const responseRateRaw =
    totalMembers > 0 ? (respondedMembers / totalMembers) * 100 : 0;
  const responseRate = Math.round(responseRateRaw * 100) / 100;

  const totalClosedWonRevenueVal = input.opportunities
    .filter((opp) => opp.stage === "Closed Won")
    .reduce((sum, opp) => sum + (Number.parseFloat(opp.amount || "0") || 0), 0);

  const actualCostVal = Number.parseFloat(input.actualCost) || 0;
  let roiVal = 0;
  if (actualCostVal > 0) {
    roiVal = ((totalClosedWonRevenueVal - actualCostVal) / actualCostVal) * 100;
  }

  return {
    totalMembers,
    respondedMembers,
    responseRate,
    totalClosedWonRevenue: totalClosedWonRevenueVal.toFixed(2),
    netRevenueRoi: roiVal.toFixed(2),
  };
}

export function calculateCampaignRevenueShare(
  opportunityAmount: string,
  percentage: number,
): string {
  const amount = Number.parseFloat(opportunityAmount) || 0;
  return (amount * (percentage / 100)).toFixed(2);
}

export function validateInfluencePercentageTotal(
  existingInfluences: { influencePercentage: number }[],
  newPercentage: number,
): boolean {
  const currentTotal = existingInfluences.reduce(
    (sum, inf) => sum + inf.influencePercentage,
    0,
  );
  return currentTotal + newPercentage <= 100;
}

export function calculateCampaignROI(params: {
  campaign: {
    id: string;
    name: string;
    budgetedCost: string;
    actualCost: string;
    expectedRevenue: string;
  };
  members: { status: string }[];
  influences: { opportunityId: string; revenueShare: string }[];
  wonOpportunityIds: Set<string>;
}): CampaignROIMetrics {
  const budgetedCost = Number(params.campaign.budgetedCost) || 0;
  const actualCost = Number(params.campaign.actualCost) || 0;
  const expectedRevenue = Number(params.campaign.expectedRevenue) || 0;

  const totalMembers = params.members.length;
  const respondedMembers = params.members.filter(
    (m) => m.status === "Responded",
  ).length;

  const wonInfluences = params.influences.filter((inf) =>
    params.wonOpportunityIds.has(inf.opportunityId),
  );

  const wonOpportunitiesCount = new Set(
    wonInfluences.map((inf) => inf.opportunityId),
  ).size;
  const wonRevenueShareSum = wonInfluences.reduce(
    (acc, inf) => acc + (Number(inf.revenueShare) || 0),
    0,
  );

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
