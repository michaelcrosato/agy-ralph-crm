import type {
  AdjustedForecastSummaryResult,
  ForecastAdjustmentInput,
  GeneratedSchedule,
  SimpleAccountRelation,
  SimpleOpportunityRelation,
  StageDuration,
  StageHistoryInput,
} from "../../types";

export function calculateStageVelocity(
  history: StageHistoryInput[],
  now: Date = new Date(),
): Record<string, StageDuration> {
  const oppHistories: Record<string, StageHistoryInput[]> = {};
  for (const h of history) {
    if (!oppHistories[h.opportunityId]) {
      oppHistories[h.opportunityId] = [];
    }
    oppHistories[h.opportunityId].push(h);
  }

  const stageDurations: Record<string, { totalMs: number; count: number }> = {};

  for (const oppId in oppHistories) {
    const sorted = [...oppHistories[oppId]].sort(
      (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
    );

    for (let i = 0; i < sorted.length; i++) {
      const current = sorted[i];
      const stage = current.toStage;
      let durationMs = 0;

      if (i < sorted.length - 1) {
        durationMs =
          sorted[i + 1].createdAt.getTime() - current.createdAt.getTime();
      } else {
        // Last stage: if it's not Closed Won or Closed Lost, measure up to now
        if (stage !== "Closed Won" && stage !== "Closed Lost") {
          durationMs = Math.max(0, now.getTime() - current.createdAt.getTime());
        } else {
          durationMs = 0;
        }
      }

      if (!stageDurations[stage]) {
        stageDurations[stage] = { totalMs: 0, count: 0 };
      }
      stageDurations[stage].totalMs += durationMs;
      stageDurations[stage].count += 1;
    }
  }

  const result: Record<string, StageDuration> = {};
  for (const stage in stageDurations) {
    const { totalMs, count } = stageDurations[stage];
    const averageDurationDaysRaw =
      count > 0 ? totalMs / (1000 * 60 * 60 * 24) / count : 0;
    result[stage] = {
      stage,
      totalDurationMs: totalMs,
      transitionCount: count,
      averageDurationDays: Math.round(averageDurationDaysRaw * 100) / 100,
    };
  }

  return result;
}

export function calculateContractRenewalAmount(
  baseAmount: string,
  escalationPercentage = 5,
): string {
  const amount = Number.parseFloat(baseAmount) || 0;
  const markup = 1 + escalationPercentage / 100;
  return (amount * markup).toFixed(2);
}

export function isContractInRenewalWindow(
  contract: { status: string; endDate: Date },
  daysBeforeExpiration = 90,
  referenceDate = new Date(),
): boolean {
  if (contract.status !== "Active") return false;
  const diffTime = contract.endDate.getTime() - referenceDate.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays >= 0 && diffDays <= daysBeforeExpiration;
}

export function rollupHierarchyPipeline(
  accounts: SimpleAccountRelation[],
  opportunities: SimpleOpportunityRelation[],
  rootAccountId: string,
): { activePipeline: string; closedWonPipeline: string } {
  // Find all children descendants of the root account
  const descendantIds = new Set<string>([rootAccountId]);

  // Keep scanning until no new descendants are added
  let added = true;
  while (added) {
    added = false;
    for (const acct of accounts) {
      if (
        acct.parentAccountId &&
        descendantIds.has(acct.parentAccountId) &&
        !descendantIds.has(acct.id)
      ) {
        descendantIds.add(acct.id);
        added = true;
      }
    }
  }

  let activeSum = 0;
  let closedWonSum = 0;

  for (const opp of opportunities) {
    if (opp.accountId && descendantIds.has(opp.accountId)) {
      const amount = Number.parseFloat(opp.amount || "0") || 0;
      if (opp.stage === "Closed Won") {
        closedWonSum += amount;
      } else if (opp.stage !== "Closed Lost") {
        activeSum += amount;
      }
    }
  }

  return {
    activePipeline: activeSum.toFixed(2),
    closedWonPipeline: closedWonSum.toFixed(2),
  };
}

export function calculateSlaStatus(
  createdAt: Date,
  maxResponseTimeMinutes: number,
  respondedAt: Date | null,
  currentTime: Date,
): {
  status: "Pending" | "Met" | "Breached";
  responseTimeMinutes: number | null;
} {
  if (respondedAt) {
    const diffMs = respondedAt.getTime() - createdAt.getTime();
    const diffMins = Math.round(diffMs / 60000);
    return {
      status: diffMins <= maxResponseTimeMinutes ? "Met" : "Breached",
      responseTimeMinutes: diffMins,
    };
  }

  const diffMs = currentTime.getTime() - createdAt.getTime();
  const diffMins = Math.round(diffMs / 60000);
  if (diffMins > maxResponseTimeMinutes) {
    return {
      status: "Breached",
      responseTimeMinutes: diffMins,
    };
  }

  return {
    status: "Pending",
    responseTimeMinutes: null,
  };
}

export function generateStraightLineSchedules(
  opportunityProductId: string,
  totalAmount: string,
  periodsCount: number,
  startDate: Date,
  scheduleType: "revenue" | "quantity" = "revenue",
): GeneratedSchedule[] {
  const total = Number.parseFloat(totalAmount) || 0;
  const schedules: GeneratedSchedule[] = [];

  if (periodsCount <= 0 || total <= 0) {
    return [];
  }

  if (scheduleType === "quantity") {
    // Integer quantity straight line distribution
    const baseQty = Math.floor(total);
    const quotient = Math.floor(baseQty / periodsCount);
    const remainder = baseQty % periodsCount;

    for (let i = 0; i < periodsCount; i++) {
      const date = new Date(startDate.getTime());
      date.setMonth(date.getMonth() + i);

      // Distribute remainder to first periods
      const qty = quotient + (i < remainder ? 1 : 0);

      schedules.push({
        opportunityProductId,
        scheduleType,
        scheduleDate: date,
        amount: String(qty),
        description: `Straight-line quantity schedule ${i + 1} of ${periodsCount}`,
      });
    }
  } else {
    // Decimal revenue straight line distribution
    const amountPerPeriod = Number((total / periodsCount).toFixed(2));
    let accumulated = 0;

    for (let i = 0; i < periodsCount; i++) {
      const date = new Date(startDate.getTime());
      date.setMonth(date.getMonth() + i);

      let currentAmount = amountPerPeriod;
      if (i === periodsCount - 1) {
        // Adjust final period to avoid rounding discrepancy
        currentAmount = Number((total - accumulated).toFixed(2));
      } else {
        accumulated += currentAmount;
      }

      schedules.push({
        opportunityProductId,
        scheduleType,
        scheduleDate: date,
        amount: currentAmount.toFixed(2),
        description: `Straight-line revenue schedule ${i + 1} of ${periodsCount}`,
      });
    }
  }

  return schedules;
}

export function calculateAdjustedForecast(params: {
  period: string;
  baseQuota: number;
  baseWeightedAmount: number;
  closedWonAmount: number;
  adjustments: ForecastAdjustmentInput[];
}): AdjustedForecastSummaryResult {
  const {
    period,
    baseQuota,
    baseWeightedAmount,
    closedWonAmount,
    adjustments,
  } = params;

  let adjustedQuota = baseQuota;
  let adjustedWeightedAmount = baseWeightedAmount;

  for (const adj of adjustments) {
    if (adj.period !== period) continue;
    const amountVal = Number.parseFloat(adj.amount) || 0;
    if (adj.adjustmentType === "override_quota") {
      adjustedQuota = amountVal;
    } else if (adj.adjustmentType === "override_weighted") {
      adjustedWeightedAmount = amountVal;
    } else if (adj.adjustmentType === "manager_adjustment") {
      adjustedWeightedAmount += amountVal;
    }
  }

  const baseAttainment =
    baseQuota > 0 ? Math.round((closedWonAmount / baseQuota) * 10000) / 100 : 0;
  const adjustedAttainment =
    adjustedQuota > 0
      ? Math.round((closedWonAmount / adjustedQuota) * 10000) / 100
      : 0;

  return {
    period,
    baseQuota: Math.round(baseQuota * 100) / 100,
    adjustedQuota: Math.round(adjustedQuota * 100) / 100,
    baseWeightedAmount: Math.round(baseWeightedAmount * 100) / 100,
    adjustedWeightedAmount: Math.round(adjustedWeightedAmount * 100) / 100,
    baseAttainment,
    adjustedAttainment,
  };
}
