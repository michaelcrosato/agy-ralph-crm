export const FORECASTING_VERSION = "0.1.0";

export const DEFAULT_STAGE_PROBABILITIES: Record<string, number> = {
  Prospecting: 10,
  Qualification: 20,
  "Needs Analysis": 30,
  Proposal: 60,
  Negotiation: 80,
  "Closed Won": 100,
  "Closed Lost": 0,
};

export interface OpportunityInput {
  id: string;
  stage: string;
  amount: string | null;
  closeDate: Date | null;
}

export interface ForecastPeriodSummary {
  period: string;
  actualAmount: number;
  weightedAmount: number;
  count: number;
}

export interface ForecastSummaryResult {
  totalPipelineAmount: number;
  totalWeightedAmount: number;
  attainmentPercentage: number;
  byPeriod: ForecastPeriodSummary[];
}

// Returns the win probability (0-100) for a given stage, checking custom mappings first
export function getStageProbability(
  stage: string,
  customProbabilities: Record<string, number> = {},
): number {
  if (customProbabilities[stage] !== undefined) {
    return customProbabilities[stage];
  }
  return DEFAULT_STAGE_PROBABILITIES[stage] !== undefined
    ? DEFAULT_STAGE_PROBABILITIES[stage]
    : 10; // Default fallback to 10%
}

// Calculate the weighted amount for a single opportunity
export function calculateWeightedAmount(
  amountStr: string | null,
  stage: string,
  customProbabilities: Record<string, number> = {},
): number {
  const amount = Number.parseFloat(amountStr || "0");
  if (Number.isNaN(amount) || amount <= 0) return 0;
  const probability = getStageProbability(stage, customProbabilities);
  return (amount * probability) / 100;
}

// Compute attainment percentage (attainment = (won / target) * 100)
export function calculateQuotaAttainment(
  closedWonSum: number,
  targetQuota: number,
): number {
  if (targetQuota <= 0) return 0;
  const percentage = (closedWonSum / targetQuota) * 100;
  return Math.round(percentage * 100) / 100;
}

// Run aggregation against opportunities and compile a forecast summary
export function compileForecastSummary(params: {
  opportunities: OpportunityInput[];
  targetQuota: number;
  customProbabilities?: Record<string, number>;
}): ForecastSummaryResult {
  const { opportunities, targetQuota, customProbabilities = {} } = params;

  let totalPipelineAmount = 0;
  let totalWeightedAmount = 0;
  let closedWonSum = 0;

  const periodGroups: Record<
    string,
    { actual: number; weighted: number; count: number }
  > = {};

  for (const opp of opportunities) {
    const amount = Number.parseFloat(opp.amount || "0");
    const parsedAmount = Number.isNaN(amount) ? 0 : amount;
    const weighted = calculateWeightedAmount(
      opp.amount,
      opp.stage,
      customProbabilities,
    );

    totalPipelineAmount += parsedAmount;
    totalWeightedAmount += weighted;

    if (opp.stage === "Closed Won") {
      closedWonSum += parsedAmount;
    }

    // Determine closeDate period month ("YYYY-MM")
    let period = "None";
    if (opp.closeDate) {
      try {
        const d = new Date(opp.closeDate);
        if (!Number.isNaN(d.getTime())) {
          period = d.toISOString().substring(0, 7);
        }
      } catch (err) {
        period = "None";
      }
    }

    if (!periodGroups[period]) {
      periodGroups[period] = { actual: 0, weighted: 0, count: 0 };
    }
    periodGroups[period].actual += parsedAmount;
    periodGroups[period].weighted += weighted;
    periodGroups[period].count += 1;
  }

  const byPeriod = Object.entries(periodGroups).map(([period, metrics]) => ({
    period,
    actualAmount: Math.round(metrics.actual * 100) / 100,
    weightedAmount: Math.round(metrics.weighted * 100) / 100,
    count: metrics.count,
  }));

  // Sort periods chronologically
  byPeriod.sort((a, b) => a.period.localeCompare(b.period));

  const attainmentPercentage = calculateQuotaAttainment(
    closedWonSum,
    targetQuota,
  );

  return {
    totalPipelineAmount: Math.round(totalPipelineAmount * 100) / 100,
    totalWeightedAmount: Math.round(totalWeightedAmount * 100) / 100,
    attainmentPercentage,
    byPeriod,
  };
}
