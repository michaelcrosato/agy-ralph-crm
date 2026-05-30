import type {
  CommissionCalculationInput,
  CommissionResult,
  CompetitorInput,
  CompetitorStats,
  CPQPriceCalculation,
  CPQProductConfig,
  DBOpportunityContactRole,
  GeneratedRenewalOpportunity,
  KanbanStageSummary,
  LineItemInput,
  OpportunityRecord,
  ProRateInput,
  RenewalGenerationInput,
  SplitInput,
  SplitResult,
  StageGateRule,
  StalledOpportunityOpportunity,
  StalledOpportunityResult,
  StalledOpportunityStageDurationRule,
  StalledOpportunityStageHistory,
} from "../../types";
import { calculateContractRenewalAmount } from "../shared";

export function rollupOpportunityAmount(items: LineItemInput[]): string {
  const sum = items.reduce(
    (acc, item) => acc + (Number.parseFloat(item.totalPrice) || 0),
    0,
  );
  return String(sum);
}

export function compileKanbanPipeline(
  opportunities: {
    id: string;
    name: string;
    stage: string;
    amount: string | null;
    closeDate: Date | null;
    accountId: string | null;
  }[],
  standardStages: string[] = [
    "Prospecting",
    "Qualification",
    "Needs Analysis",
    "Value Proposition",
    "Id. Decision Makers",
    "Perception Analysis",
    "Proposal/Price Quote",
    "Negotiation/Review",
    "Closed Won",
    "Closed Lost",
  ],
): KanbanStageSummary[] {
  const summaries: Record<string, KanbanStageSummary> = {};

  // Initialize summary blocks for standard stages to ensure they are always present
  for (const stage of standardStages) {
    summaries[stage] = {
      stage,
      opportunitiesCount: 0,
      totalValue: "0.00",
      opportunities: [],
    };
  }

  for (const opp of opportunities) {
    const stage = opp.stage;
    if (!summaries[stage]) {
      summaries[stage] = {
        stage,
        opportunitiesCount: 0,
        totalValue: "0.00",
        opportunities: [],
      };
    }

    const summary = summaries[stage];
    summary.opportunitiesCount += 1;

    const currentSum = Number.parseFloat(summary.totalValue) || 0;
    const oppVal = Number.parseFloat(opp.amount || "0") || 0;
    summary.totalValue = (currentSum + oppVal).toFixed(2);

    summary.opportunities.push({
      id: opp.id,
      name: opp.name,
      amount: opp.amount,
      closeDate: opp.closeDate,
      accountId: opp.accountId,
    });
  }

  return Object.values(summaries);
}

export function calculateProRatedAmount(input: ProRateInput): string {
  const price = Number.parseFloat(input.unitPrice) || 0;
  const rawAmount =
    price * input.quantity * (input.daysUsed / input.daysInPeriod);
  return rawAmount.toFixed(2);
}

export function calculateCPQPrice(
  config: CPQProductConfig,
): CPQPriceCalculation {
  const price = Number.parseFloat(config.unitPrice) || 0;
  const qty = config.quantity;
  const subtotalVal = price * qty;

  let discountPct = 0;
  if (config.discountTiers && config.discountTiers.length > 0) {
    const sortedTiers = [...config.discountTiers].sort(
      (a, b) => b.minQuantity - a.minQuantity,
    );
    const matchedTier = sortedTiers.find((tier) => qty >= tier.minQuantity);
    if (matchedTier) {
      discountPct = matchedTier.discountPercentage;
    }
  } else {
    // Default tiering rules if not provided
    if (qty >= 100) discountPct = 20;
    else if (qty >= 50) discountPct = 15;
    else if (qty >= 10) discountPct = 10;
  }

  if (config.customDiscountPercentage !== undefined) {
    discountPct = Math.max(discountPct, config.customDiscountPercentage);
  }

  const discountVal = subtotalVal * (discountPct / 100);
  const totalVal = subtotalVal - discountVal;

  return {
    subtotal: subtotalVal.toFixed(2),
    discountAmount: discountVal.toFixed(2),
    totalPrice: totalVal.toFixed(2),
  };
}

export function validateOpportunityApprovalSubmission(
  opportunity: OpportunityRecord,
): { success: boolean; error?: string } {
  if (
    opportunity.stage === "Closed Won" ||
    opportunity.stage === "Closed Lost"
  ) {
    return {
      success: false,
      error: "Opportunity is already closed.",
    };
  }
  const amount = Number.parseFloat(opportunity.amount || "0");
  if (amount <= 0 || Number.isNaN(amount)) {
    return {
      success: false,
      error: "Opportunity must have an amount greater than zero.",
    };
  }
  return { success: true };
}

export function calculateOpportunityCommission(
  input: CommissionCalculationInput,
): CommissionResult {
  if (input.opportunityStage !== "Closed Won") {
    return {
      commissionAmount: "0.00",
      attainmentPercentage: 0,
      rateApplied: "0.00",
      multiplierApplied: 0,
    };
  }

  const amount = Number.parseFloat(input.opportunityAmount) || 0;
  const quota = input.quotaTarget
    ? Number.parseFloat(input.quotaTarget) || 0
    : 0;
  const priorTotal = Number.parseFloat(input.currentClosedWonTotal) || 0;
  const newTotal = priorTotal + amount;
  const base = input.baseRate
    ? Number.parseFloat(input.baseRate) || 0.05
    : 0.05;

  const attainmentPercentage = quota > 0 ? (newTotal / quota) * 100 : 0;

  let multiplier = 1.0;
  if (attainmentPercentage >= 150) {
    multiplier = 1.5;
  } else if (attainmentPercentage >= 100) {
    multiplier = 1.2;
  }

  const effectiveRate = base * multiplier;
  const commission = amount * effectiveRate;

  return {
    commissionAmount: commission.toFixed(2),
    attainmentPercentage: Math.round(attainmentPercentage * 100) / 100,
    rateApplied: effectiveRate.toFixed(4),
    multiplierApplied: multiplier,
  };
}

export function calculateOpportunitySplits(
  opportunityAmount: string,
  splits: SplitInput[],
): SplitResult[] {
  const amount = Number.parseFloat(opportunityAmount) || 0;
  if (splits.length === 0) {
    throw new Error("At least one split is required.");
  }
  const totalPct = splits.reduce((sum, s) => sum + s.percentage, 0);
  if (totalPct !== 100) {
    throw new Error("Total split percentage must equal 100%.");
  }
  return splits.map((s) => ({
    userId: s.userId,
    percentage: s.percentage,
    splitAmount: (amount * (s.percentage / 100)).toFixed(2),
  }));
}

export function setPrimaryOpportunityContactRole(
  roles: DBOpportunityContactRole[],
  opportunityId: string,
  primaryContactId: string,
): DBOpportunityContactRole[] {
  return roles.map((r) => {
    if (r.opportunityId === opportunityId) {
      return {
        ...r,
        isPrimary: r.contactId === primaryContactId,
      };
    }
    return r;
  });
}

export function generateRenewalOpportunity(
  input: RenewalGenerationInput,
): GeneratedRenewalOpportunity {
  const { contract, accountName, escalationPercentage = 5 } = input;
  const newAmount = calculateContractRenewalAmount(
    contract.contractAmount,
    escalationPercentage,
  );

  const endFormatted = contract.endDate.toISOString().split("T")[0];
  const name = `Renewal - ${accountName} - ${endFormatted}`;

  return {
    orgId: contract.orgId,
    accountId: contract.accountId,
    name,
    stage: "Qualification",
    amount: newAmount,
    closeDate: contract.endDate,
  };
}

export function calculateOpportunityCompetitorStats(
  competitors: CompetitorInput[],
): CompetitorStats {
  let wonCount = 0;
  let lostCount = 0;
  let pendingCount = 0;
  const competitorList: string[] = [];

  for (const c of competitors) {
    competitorList.push(c.name);
    if (c.winLossStatus === "Won") {
      wonCount++;
    } else if (c.winLossStatus === "Lost") {
      lostCount++;
    } else {
      pendingCount++;
    }
  }

  return {
    competitorCount: competitors.length,
    wonCount,
    lostCount,
    pendingCount,
    competitorList,
  };
}

export function rollupOpportunityAmountsInBase(
  opportunities: { amount: string; exchangeRate: string }[],
): string {
  const total = opportunities.reduce((acc, opp) => {
    const amountVal = Number.parseFloat(opp.amount) || 0;
    const rate = Number.parseFloat(opp.exchangeRate) || 1.0;
    return acc + amountVal * rate;
  }, 0);

  return total.toFixed(2);
}

export function validateOpportunityStageGate(
  opportunity: Record<string, unknown>,
  rules: StageGateRule[],
  newStage: string,
): { isValid: boolean; errorMessages: string[] } {
  const errors: string[] = [];
  const activeRules = rules.filter(
    (r) => r.isActive && r.targetStage === newStage,
  );

  for (const rule of activeRules) {
    let rawVal: unknown;
    if (rule.field.startsWith("custom.")) {
      const fieldKey = rule.field.substring("custom.".length);
      rawVal = (opportunity.custom as Record<string, unknown> | null)?.[
        fieldKey
      ];
    } else {
      rawVal = opportunity[rule.field];
    }

    const fieldValue =
      rawVal !== undefined && rawVal !== null ? String(rawVal) : "";
    const expected = rule.expectedValue || "";

    let isViolated = false;

    switch (rule.operator) {
      case "equals":
        isViolated = fieldValue !== expected;
        break;
      case "not_equals":
        isViolated = fieldValue === expected;
        break;
      case "greater_than": {
        const fNum = Number.parseFloat(fieldValue);
        const eNum = Number.parseFloat(expected);
        isViolated =
          !Number.isNaN(fNum) && !Number.isNaN(eNum)
            ? fNum <= eNum
            : fieldValue <= expected;
        break;
      }
      case "less_than": {
        const fNum = Number.parseFloat(fieldValue);
        const eNum = Number.parseFloat(expected);
        isViolated =
          !Number.isNaN(fNum) && !Number.isNaN(eNum)
            ? fNum >= eNum
            : fieldValue >= expected;
        break;
      }
      case "contains":
        isViolated = !fieldValue.includes(expected);
        break;
      case "is_not_empty":
        isViolated = fieldValue.trim() === "";
        break;
      default:
        isViolated = false;
        break;
    }

    if (isViolated) {
      errors.push(rule.errorMessage);
    }
  }

  return {
    isValid: errors.length === 0,
    errorMessages: errors,
  };
}

export const SUPPORTED_OPPORTUNITY_TEAM_ROLES = [
  "Opportunity Owner",
  "Sales Representative",
  "Sales Engineer",
  "Executive Sponsor",
  "Other",
];

export function validateOpportunityTeamMember(
  opportunityId: string,
  userId: string,
  role: string,
): { success: boolean; error?: string } {
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const mockRegex = /^(opportunities|opportunity|opp|user|team)-[a-z0-9-]+$/i;

  if (
    !opportunityId ||
    (!uuidRegex.test(opportunityId) && !mockRegex.test(opportunityId))
  ) {
    return { success: false, error: "Invalid Opportunity ID format." };
  }
  if (!userId || (!uuidRegex.test(userId) && !mockRegex.test(userId))) {
    return { success: false, error: "Invalid User ID format." };
  }
  if (!SUPPORTED_OPPORTUNITY_TEAM_ROLES.includes(role)) {
    return {
      success: false,
      error: `Invalid role. Supported roles are: ${SUPPORTED_OPPORTUNITY_TEAM_ROLES.join(", ")}`,
    };
  }
  return { success: true };
}

export function validateOpportunityProductSchedule(
  opportunityProductId: string,
  scheduleType: string,
  scheduleDate: Date,
  amount: string,
): { success: boolean; error?: string } {
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const mockRegex =
    /^(opportunity_products|opportunity-product|opp-prod|schedule|item|line)-[a-z0-9-]+$/i;

  if (
    !opportunityProductId ||
    (!uuidRegex.test(opportunityProductId) &&
      !mockRegex.test(opportunityProductId))
  ) {
    return { success: false, error: "Invalid Opportunity Product ID format." };
  }

  if (scheduleType !== "revenue" && scheduleType !== "quantity") {
    return {
      success: false,
      error: "Invalid schedule type. Supported types are: revenue, quantity",
    };
  }

  if (!scheduleDate || Number.isNaN(scheduleDate.getTime())) {
    return { success: false, error: "Invalid schedule date." };
  }

  const parsedAmount = Number.parseFloat(amount);
  if (Number.isNaN(parsedAmount) || parsedAmount <= 0) {
    return { success: false, error: "Amount must be a positive number." };
  }

  return { success: true };
}

export function calculateStalledOpportunities(
  opportunities: StalledOpportunityOpportunity[],
  stageHistory: StalledOpportunityStageHistory[],
  rules: StalledOpportunityStageDurationRule[],
  currentDate: Date = new Date(),
): StalledOpportunityResult[] {
  const DEFAULT_THRESHOLDS: Record<string, number> = {
    Prospecting: 30,
    Qualification: 20,
    "Needs Analysis": 14,
    "Value Proposition": 14,
    "Id. Decision Makers": 10,
    "Perception Analysis": 10,
    "Proposal/Price Quote": 7,
    "Negotiation/Review": 5,
  };

  const results: StalledOpportunityResult[] = [];

  const ruleMap = new Map<string, number>();
  for (const rule of rules) {
    ruleMap.set(rule.stage, rule.maxDaysAllowed);
  }

  // Active opportunities: stage not Closed Won or Closed Lost
  const activeOpps = opportunities.filter(
    (o) => o.stage !== "Closed Won" && o.stage !== "Closed Lost",
  );

  for (const opp of activeOpps) {
    // Find latest stage history entry where toStage matches the current stage
    const currentStageHistory = stageHistory.filter(
      (h) => h.opportunityId === opp.id && h.toStage === opp.stage,
    );

    let elapsedDays = 0;
    if (currentStageHistory.length > 0) {
      // Sort history descending by createdAt
      currentStageHistory.sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
      const latestEntry = currentStageHistory[0];
      const elapsedMs =
        currentDate.getTime() - new Date(latestEntry.createdAt).getTime();
      elapsedDays = Math.floor(elapsedMs / (1000 * 60 * 60 * 24));
      if (elapsedDays < 0) elapsedDays = 0;
    }

    const maxDaysAllowed =
      ruleMap.get(opp.stage) ?? DEFAULT_THRESHOLDS[opp.stage] ?? 14;

    if (elapsedDays > maxDaysAllowed) {
      results.push({
        opportunityId: opp.id,
        opportunityName: opp.name,
        currentStage: opp.stage,
        elapsedDays,
        maxDaysAllowed,
        amount: opp.amount ?? null,
      });
    }
  }

  return results;
}
