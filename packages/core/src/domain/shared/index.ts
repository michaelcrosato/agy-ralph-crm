import type {
  AdjustedForecastSummaryResult,
  AgentCSATMetricsInput,
  AgentCSATMetricsResult,
  CompetitorRecord,
  ConsentValidationInput,
  CoreReportRunResult,
  CoreScheduledReport,
  CoreScheduledReportRun,
  CoreSequenceExclusion,
  CoreSequenceStep,
  CoreSequenceSuppression,
  CSATFeedbackInput,
  EngagementScoreEventsInput,
  FolderNode,
  ForecastAdjustmentInput,
  GeneratedSchedule,
  GlobalCompetitorMetrics,
  LinkEngagementInput,
  LinkEngagementResult,
  LinkPerformanceMetric,
  OpportunityRecord,
  SimpleAccountRelation,
  SimpleOpportunityRelation,
  StageDuration,
  StageHistoryInput,
  SyncSimulationInput,
} from "../../types";
import { parseTimeToMinutes } from "../csv";

export const CORE_VERSION = "0.1.0";

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

export const SUPPORTED_TEAM_ROLES = [
  "Account Manager",
  "Sales Engineer",
  "Customer Success Manager",
  "Executive Sponsor",
  "Other",
];

export function validateStageGuidanceKeyFields(
  record: Record<string, unknown>,
  keyFields: string[],
): {
  isClean: boolean;
  missingFields: string[];
} {
  const missingFields: string[] = [];

  for (const field of keyFields) {
    let value: unknown;

    if (field.startsWith("custom.")) {
      const fieldKey = field.substring("custom.".length);
      value = (record.custom as Record<string, unknown> | null)?.[fieldKey];
    } else {
      value = record[field];
    }

    const isEmpty =
      value === undefined ||
      value === null ||
      (typeof value === "string" && value.trim() === "");

    if (isEmpty) {
      missingFields.push(field);
    }
  }

  return {
    isClean: missingFields.length === 0,
    missingFields,
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

export function calculateGlobalCompetitorAnalytics(params: {
  competitors: CompetitorRecord[];
  opportunities: OpportunityRecord[];
}): GlobalCompetitorMetrics[] {
  const oppMap = new Map<string, OpportunityRecord>();
  for (const opp of params.opportunities) {
    oppMap.set(opp.id, opp);
  }

  const groups = new Map<
    string,
    {
      displayName: string;
      competitors: CompetitorRecord[];
    }
  >();

  for (const comp of params.competitors) {
    const norm = comp.name.trim().toLowerCase();
    if (!norm) continue;
    let grp = groups.get(norm);
    if (!grp) {
      grp = {
        displayName: comp.name.trim(),
        competitors: [],
      };
      groups.set(norm, grp);
    }
    grp.competitors.push(comp);
  }

  const results: GlobalCompetitorMetrics[] = [];

  for (const [_, group] of groups) {
    let wonCount = 0;
    let lostCount = 0;
    let totalValue = 0;
    let wonValue = 0;
    const strengthsSet = new Set<string>();
    const weaknessesSet = new Set<string>();
    const seenOpps = new Set<string>();

    for (const comp of group.competitors) {
      const opp = oppMap.get(comp.opportunityId);
      if (!opp) continue;

      if (!seenOpps.has(opp.id)) {
        seenOpps.add(opp.id);
        const amountVal = Number.parseFloat(opp.amount || "0") || 0;
        totalValue += amountVal;

        if (opp.stage === "Closed Won" && comp.winLossStatus === "Lost") {
          wonCount++;
          wonValue += amountVal;
        } else if (
          opp.stage === "Closed Lost" &&
          comp.winLossStatus === "Won"
        ) {
          lostCount++;
        }
      }

      if (comp.strength?.trim()) {
        strengthsSet.add(comp.strength.trim());
      }
      if (comp.weakness?.trim()) {
        weaknessesSet.add(comp.weakness.trim());
      }
    }

    const totalDecided = wonCount + lostCount;
    const winRate =
      totalDecided > 0
        ? Math.round((wonCount / totalDecided) * 100 * 100) / 100
        : 0.0;

    results.push({
      name: group.displayName,
      totalCompetitions: seenOpps.size,
      wonCount,
      lostCount,
      winRate,
      totalValue: totalValue.toFixed(2),
      wonValue: wonValue.toFixed(2),
      strengths: Array.from(strengthsSet),
      weaknesses: Array.from(weaknessesSet),
    });
  }

  return results;
}

export function validateCommunicationConsent(
  input: ConsentValidationInput,
): boolean {
  const matchingRule = input.preferences.find(
    (p) => p.channel === input.channel,
  );
  if (!matchingRule) return false;
  return matchingRule.status === "opt_in";
}

export function syncExternalItems(input: SyncSimulationInput) {
  const syncedEmails: {
    externalId: string;
    subject: string;
    body: string;
    receivedAt: Date;
    targetType: "Lead" | "Contact";
    targetId: string;
  }[] = [];

  const syncedEvents: {
    externalId: string;
    title: string;
    description: string;
    eventDate: Date;
    targetType: "Lead" | "Contact";
    targetId: string;
  }[] = [];

  // Match and sync emails
  if (input.settings.syncEmails) {
    for (const email of input.externalEmails) {
      if (input.existingActivityExternalIds.includes(email.externalId))
        continue;

      // Check contacts first
      const contact = input.existingContacts.find(
        (c) =>
          c.email?.toLowerCase() === email.sender.toLowerCase() ||
          c.email?.toLowerCase() === email.recipient.toLowerCase(),
      );
      if (contact) {
        syncedEmails.push({
          externalId: email.externalId,
          subject: email.subject,
          body: email.body,
          receivedAt: email.receivedAt,
          targetType: "Contact",
          targetId: contact.id,
        });
        continue;
      }

      // Check leads next
      const lead = input.existingLeads.find(
        (l) =>
          l.email?.toLowerCase() === email.sender.toLowerCase() ||
          l.email?.toLowerCase() === email.recipient.toLowerCase(),
      );
      if (lead) {
        syncedEmails.push({
          externalId: email.externalId,
          subject: email.subject,
          body: email.body,
          receivedAt: email.receivedAt,
          targetType: "Lead",
          targetId: lead.id,
        });
      }
    }
  }

  // Match and sync calendar events
  if (input.settings.syncCalendar) {
    for (const event of input.externalCalendarEvents) {
      if (input.existingActivityExternalIds.includes(event.externalId))
        continue;

      let matched = false;
      for (const attendee of event.attendees) {
        const contact = input.existingContacts.find(
          (c) => c.email?.toLowerCase() === attendee.toLowerCase(),
        );
        if (contact) {
          syncedEvents.push({
            externalId: event.externalId,
            title: event.title,
            description: event.description,
            eventDate: event.eventDate,
            targetType: "Contact",
            targetId: contact.id,
          });
          matched = true;
          break; // Avoid linking the same event multiple times if there are multiple attendees
        }
      }

      if (matched) continue;

      for (const attendee of event.attendees) {
        const lead = input.existingLeads.find(
          (l) => l.email?.toLowerCase() === attendee.toLowerCase(),
        );
        if (lead) {
          syncedEvents.push({
            externalId: event.externalId,
            title: event.title,
            description: event.description,
            eventDate: event.eventDate,
            targetType: "Lead",
            targetId: lead.id,
          });
          break;
        }
      }
    }
  }

  return { syncedEmails, syncedEvents };
}

export function validateArticleStatus(status: string): boolean {
  return status === "Draft" || status === "Published";
}

export function incrementArticleViewCount(currentCount: number): number {
  if (currentCount < 0) return 0;
  return currentCount + 1;
}

export function calculateAgentCSATMetrics(
  input: AgentCSATMetricsInput,
): AgentCSATMetricsResult {
  const agentTickets = input.tickets.filter(
    (t) => t.assignedToId === input.agentId,
  );
  const totalTickets = agentTickets.length;

  const resolvedOrClosedTickets = agentTickets.filter(
    (t) => t.status === "Resolved" || t.status === "Closed",
  );
  const resolvedTickets = resolvedOrClosedTickets.length;

  // Find all CSAT survey responses linked to this agent's tickets
  const ticketIds = new Set(agentTickets.map((t) => t.id));
  const agentResponses = input.responses.filter(
    (r) => r.ticketId && ticketIds.has(r.ticketId),
  );

  let averageCsat = "0.00";
  let satisfactionRate = 0;

  if (agentResponses.length > 0) {
    const sum = agentResponses.reduce((acc, curr) => acc + curr.score, 0);
    averageCsat = (sum / agentResponses.length).toFixed(2);

    const positiveCount = agentResponses.filter((r) => r.score >= 4).length;
    satisfactionRate =
      Math.round((positiveCount / agentResponses.length) * 100 * 100) / 100;
  }

  // Calculate average resolution time in minutes
  let totalResolutionTimeMs = 0;
  let resolutionTimeCount = 0;

  for (const ticket of resolvedOrClosedTickets) {
    const resolvedAt = ticket.resolvedAt || new Date();
    const durationMs = resolvedAt.getTime() - ticket.createdAt.getTime();
    if (durationMs >= 0) {
      totalResolutionTimeMs += durationMs;
      resolutionTimeCount++;
    }
  }

  const averageResolutionTimeMinutes =
    resolutionTimeCount > 0
      ? Math.round(totalResolutionTimeMs / (1000 * 60) / resolutionTimeCount)
      : 0;

  return {
    totalTickets,
    resolvedTickets,
    averageCsat,
    satisfactionRate,
    averageResolutionTimeMinutes,
  };
}

export function validateCSATFeedbackInput(input: CSATFeedbackInput): {
  success: boolean;
  error?: string;
} {
  if (input.score === undefined || input.score === null) {
    return { success: false, error: "Score is required." };
  }
  if (!Number.isInteger(input.score) || input.score < 1 || input.score > 5) {
    return {
      success: false,
      error: "CSAT score must be an integer between 1 and 5.",
    };
  }
  return { success: true };
}

export function calculateNextRunDate(
  fromDate: Date,
  frequency: "daily" | "weekly" | "monthly",
): Date {
  const next = new Date(fromDate.getTime());
  if (frequency === "daily") {
    next.setDate(next.getDate() + 1);
  } else if (frequency === "weekly") {
    next.setDate(next.getDate() + 7);
  } else if (frequency === "monthly") {
    next.setMonth(next.getMonth() + 1);
  }
  return next;
}

export async function runPendingScheduledReports(
  dbStore: {
    scheduledReports: {
      findMany: () => Promise<CoreScheduledReport[]>;
      update: (
        id: string,
        updates: Partial<CoreScheduledReport>,
      ) => Promise<CoreScheduledReport | null>;
    };
    scheduledReportRuns: {
      insert: (
        r: Omit<CoreScheduledReportRun, "id" | "runAt">,
      ) => Promise<CoreScheduledReportRun>;
    };
    reports: {
      findOne: (id: string) => Promise<{
        id: string;
        orgId: string;
        name: string;
        objectType: string;
        groupBy: string;
        aggregateField: string | null;
        aggregateFunc: string;
      } | null>;
    };
  },
  _store: Record<string, unknown[]>,
  orgId: string,
  triggerWebhook?: (
    orgId: string,
    event: string,
    payload: {
      scheduleId: string;
      reportId: string;
      recipientEmail: string;
      result: CoreReportRunResult;
    },
  ) => Promise<void>,
): Promise<number> {
  const now = new Date();
  const allSchedules = await dbStore.scheduledReports.findMany();
  const pendingSchedules = allSchedules.filter(
    (s) => s.isActive === 1 && new Date(s.nextRunAt) <= now,
  );

  let processedCount = 0;

  for (const schedule of pendingSchedules) {
    let runStatus: "success" | "failed" = "success";
    let errorMessage: string | null = null;
    let reportResult: CoreReportRunResult | null = null;

    try {
      const report = await dbStore.reports.findOne(schedule.reportId);
      if (!report) {
        throw new Error(`Report with ID ${schedule.reportId} not found.`);
      }

      const objectType = report.objectType;
      const objectStore = (
        dbStore as unknown as Record<
          string,
          { findMany: () => Promise<unknown[]> }
        >
      )[objectType];
      if (!objectStore) {
        throw new Error(`Unsupported report object type: ${objectType}`);
      }
      const records = await objectStore.findMany();

      reportResult = runReportInline({
        name: report.name,
        records: records as Record<string, unknown>[],
        groupBy: report.groupBy,
        aggregateField: report.aggregateField,
        aggregateFunc: report.aggregateFunc as "count" | "sum" | "avg",
      });
    } catch (err) {
      runStatus = "failed";
      errorMessage = err instanceof Error ? err.message : String(err);
    }

    await dbStore.scheduledReportRuns.insert({
      orgId,
      scheduledReportId: schedule.id,
      status: runStatus,
      errorMessage,
    });

    const nextRun = calculateNextRunDate(
      new Date(schedule.nextRunAt),
      schedule.frequency,
    );
    await dbStore.scheduledReports.update(schedule.id, {
      nextRunAt: nextRun,
    });

    if (runStatus === "success" && triggerWebhook) {
      await triggerWebhook(orgId, "report.delivered", {
        scheduleId: schedule.id,
        reportId: schedule.reportId,
        recipientEmail: schedule.recipientEmail,
        result: reportResult as CoreReportRunResult,
      });
    }

    processedCount++;
  }

  return processedCount;
}

export function runReportInline(params: {
  name: string;
  records: Record<string, unknown>[];
  groupBy: string;
  aggregateField?: string | null;
  aggregateFunc: "count" | "sum" | "avg";
}): {
  reportName: string;
  groupBy: string;
  aggregateFunc: "count" | "sum" | "avg";
  aggregateField: string | null;
  data: { group: string; value: number }[];
} {
  const { name, records, groupBy, aggregateField, aggregateFunc } = params;

  const groups: Record<string, Record<string, unknown>[]> = {};
  for (const rec of records) {
    let val = rec[groupBy];
    if (val === undefined && rec.custom && typeof rec.custom === "object") {
      const customObj = rec.custom as Record<string, unknown>;
      val = customObj[groupBy];
    }
    const groupKey = val !== undefined && val !== null ? String(val) : "None";
    if (!groups[groupKey]) {
      groups[groupKey] = [];
    }
    groups[groupKey].push(rec);
  }

  const results = Object.entries(groups).map(([group, groupRecords]) => {
    let value = 0;
    if (aggregateFunc === "count") {
      value = groupRecords.length;
    } else {
      const field = aggregateField;
      if (!field) {
        value = groupRecords.length;
      } else {
        const numbers = groupRecords.map((rec: Record<string, unknown>) => {
          let val = rec[field];
          if (
            val === undefined &&
            rec.custom &&
            typeof rec.custom === "object"
          ) {
            const customObj = rec.custom as Record<string, unknown>;
            val = customObj[field];
          }
          const parsed = Number(val);
          return Number.isNaN(parsed) ? 0 : parsed;
        });
        const sum = numbers.reduce((a: number, b: number) => a + b, 0);
        if (aggregateFunc === "sum") {
          value = sum;
        } else if (aggregateFunc === "avg") {
          value = groupRecords.length > 0 ? sum / groupRecords.length : 0;
        }
      }
    }

    if (aggregateFunc === "avg") {
      value = Math.round(value * 100) / 100;
    }

    return {
      group,
      value,
    };
  });

  results.sort((a, b) => a.group.localeCompare(b.group));

  return {
    reportName: name,
    groupBy,
    aggregateFunc,
    aggregateField: aggregateField || null,
    data: results,
  };
}

export function isDateInPeriod(date: Date, period: string): boolean {
  if (!date || Number.isNaN(date.getTime())) return false;
  const iso = date.toISOString();
  const year = iso.substring(0, 4);
  const monthStr = iso.substring(5, 7);
  const month = Number.parseInt(monthStr, 10);

  if (period.includes("-Q")) {
    const [qYear, qStr] = period.split("-Q");
    if (year !== qYear) return false;
    const quarter = Math.ceil(month / 3);
    return quarter.toString() === qStr;
  }
  return iso.substring(0, 7) === period;
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

export function getFieldValue(
  fields: Record<string, unknown>,
  path: string,
): unknown {
  if (path in fields && fields[path] !== undefined && fields[path] !== null) {
    return fields[path];
  }
  if (path.includes(".")) {
    const parts = path.split(".");
    let current: unknown = fields;
    for (const part of parts) {
      if (
        current === null ||
        current === undefined ||
        typeof current !== "object"
      ) {
        current = undefined;
        break;
      }
      current = (current as Record<string, unknown>)[part];
    }
    if (current !== undefined && current !== null) {
      return current;
    }
  }
  if (
    fields.custom &&
    typeof fields.custom === "object" &&
    path in (fields.custom as Record<string, unknown>)
  ) {
    const val = (fields.custom as Record<string, unknown>)[path];
    if (val !== undefined && val !== null) {
      return val;
    }
  }
  return undefined;
}

export function validatePicklistDependencies(
  fields: Record<string, unknown>,
  dependencies: {
    parentField: string;
    dependentField: string;
    dependencyMap: Record<string, string[]>;
  }[],
): { success: boolean; error?: string } {
  for (const dep of dependencies) {
    const parentVal = getFieldValue(fields, dep.parentField);
    const dependentVal = getFieldValue(fields, dep.dependentField);

    // If controlling or dependent values are not set on the record mutation, skip validation
    if (
      parentVal === undefined ||
      parentVal === null ||
      dependentVal === undefined ||
      dependentVal === null
    ) {
      continue;
    }

    const parentValStr = String(parentVal);
    const dependentValStr = String(dependentVal);

    const allowedOptions = dep.dependencyMap[parentValStr];
    if (!allowedOptions?.includes(dependentValStr)) {
      return {
        success: false,
        error: `Value '${dependentValStr}' is not allowed for dependent field '${dep.dependentField}' when parent field '${dep.parentField}' is '${parentValStr}'. Allowed values are: ${allowedOptions ? allowedOptions.join(", ") : "none"}.`,
      };
    }
  }

  return { success: true };
}

export function getPartsInTimezone(date: Date, tz: string) {
  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hourCycle: "h23",
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      weekday: "short",
    });
    const parts = formatter.formatToParts(date);
    const map: Record<string, string> = {};
    for (const p of parts) {
      map[p.type] = p.value;
    }
    return {
      year: Number.parseInt(map.year, 10),
      month: Number.parseInt(map.month, 10),
      day: Number.parseInt(map.day, 10),
      hour: Number.parseInt(map.hour, 10),
      minute: Number.parseInt(map.minute, 10),
      weekday: map.weekday, // "Mon", "Tue", etc.
    };
  } catch (_e) {
    // Fallback to UTC
    const utcDate = new Date(date.getTime());
    const weekdayMap = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    return {
      year: utcDate.getUTCFullYear(),
      month: utcDate.getUTCMonth() + 1,
      day: utcDate.getUTCDate(),
      hour: utcDate.getUTCHours(),
      minute: utcDate.getUTCMinutes(),
      weekday: weekdayMap[utcDate.getUTCDay()],
    };
  }
}

export function getNextValidSendingTime(
  currentTime: Date,
  sendingDays: number[] | null,
  windowStart: string | null,
  windowEnd: string | null,
  timezone?: string | null,
): Date {
  const tz = timezone || "UTC";
  let target = new Date(currentTime.getTime());

  const allowedDays =
    sendingDays && sendingDays.length > 0 ? new Set(sendingDays) : null;
  const weekdayMap: Record<string, number> = {
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
    Sun: 7,
  };

  let attempts = 0;
  while (attempts < 8) {
    const local = getPartsInTimezone(target, tz);
    const dayOfWeek = weekdayMap[local.weekday] || 1;
    const dayAllowed = !allowedDays || allowedDays.has(dayOfWeek);

    if (dayAllowed) {
      const currentTimeMinutes = local.hour * 60 + local.minute;
      const startMinutes = windowStart ? parseTimeToMinutes(windowStart) : 0;
      const endMinutes = windowEnd ? parseTimeToMinutes(windowEnd) : 24 * 60;

      if (currentTimeMinutes < startMinutes) {
        const minutesToStart = startMinutes - currentTimeMinutes;
        return new Date(target.getTime() + minutesToStart * 60 * 1000);
      }

      if (
        currentTimeMinutes >= startMinutes &&
        currentTimeMinutes < endMinutes
      ) {
        return target;
      }
    }

    const _localForShift = getPartsInTimezone(target, tz);
    const nextTarget = new Date(target.getTime() + 24 * 60 * 60 * 1000);
    const nextLocal = getPartsInTimezone(nextTarget, tz);
    const startMinutes = windowStart ? parseTimeToMinutes(windowStart) : 0;

    const nextLocalAsUtc = new Date(
      Date.UTC(
        nextLocal.year,
        nextLocal.month - 1,
        nextLocal.day,
        nextLocal.hour,
        nextLocal.minute,
        0,
        0,
      ),
    );
    const targetLocalAsUtc = new Date(
      Date.UTC(
        nextLocal.year,
        nextLocal.month - 1,
        nextLocal.day,
        Math.floor(startMinutes / 60),
        startMinutes % 60,
        0,
        0,
      ),
    );
    const diffMs = targetLocalAsUtc.getTime() - nextLocalAsUtc.getTime();

    target = new Date(nextTarget.getTime() + diffMs);
    attempts++;
  }

  return currentTime;
}

export function calculateNextStepExecutionTime(
  currentTime: Date,
  delayDays: number,
  waitCondition?: CoreSequenceStep["waitCondition"],
): Date {
  let target = new Date(
    currentTime.getTime() + delayDays * 24 * 60 * 60 * 1000,
  );

  if (waitCondition?.waitType !== "day_of_week") {
    return target;
  }

  const daysOfWeek = waitCondition.daysOfWeek || [];
  if (daysOfWeek.length === 0) {
    return target;
  }

  let _found = false;
  for (let i = 0; i < 7; i++) {
    const day = target.getDay();
    if (daysOfWeek.includes(day)) {
      _found = true;
      break;
    }
    target = new Date(target.getTime() + 24 * 60 * 60 * 1000);
  }

  if (waitCondition.timeOfDay) {
    const parts = waitCondition.timeOfDay.split(":");
    if (parts.length === 2) {
      const hours = Number.parseInt(parts[0], 10);
      const minutes = Number.parseInt(parts[1], 10);
      if (!Number.isNaN(hours) && !Number.isNaN(minutes)) {
        target.setHours(hours, minutes, 0, 0);
      }
    }
  }

  return target;
}

export async function isRecordSuppressedOrExcluded(params: {
  orgId: string;
  sequenceId: string;
  recordType: "lead" | "contact";
  recordId: string;
  email: string | null | undefined;
  dbStore: {
    marketingSequenceSuppressions: {
      findForOrg: (orgId: string) => Promise<CoreSequenceSuppression[]>;
    };
    marketingSequenceExclusions: {
      findForSequence: (sequenceId: string) => Promise<CoreSequenceExclusion[]>;
    };
    marketingSegmentMemberships?: {
      findForRecord: (
        recordType: string,
        recordId: string,
      ) => Promise<{ segmentId: string }[]>;
    };
  };
}): Promise<{ suppressed: boolean; reason: string | null }> {
  const emailVal = params.email?.trim().toLowerCase();
  const domainVal = emailVal ? emailVal.split("@")[1] : null;

  // 1. Check Global Suppressions
  const suppressions =
    await params.dbStore.marketingSequenceSuppressions.findForOrg(params.orgId);
  for (const s of suppressions) {
    if (s.recordType === params.recordType && s.recordId === params.recordId) {
      return {
        suppressed: true,
        reason: `Global suppression list match for ${params.recordType} ID ${params.recordId} (${s.reason})`,
      };
    }
    if (s.recordType === "email_domain" && s.pattern) {
      const patternLower = s.pattern.trim().toLowerCase();
      if (emailVal === patternLower || domainVal === patternLower) {
        return {
          suppressed: true,
          reason: `Global suppression list match for pattern ${s.pattern} (${s.reason})`,
        };
      }
    }
  }

  // 2. Check Sequence Exclusions
  const exclusions =
    await params.dbStore.marketingSequenceExclusions.findForSequence(
      params.sequenceId,
    );
  if (exclusions.length > 0) {
    let recordSegments: string[] = [];
    if (params.dbStore.marketingSegmentMemberships) {
      const memberships =
        await params.dbStore.marketingSegmentMemberships.findForRecord(
          params.recordType,
          params.recordId,
        );
      recordSegments = memberships.map((m) => m.segmentId);
    }

    for (const ex of exclusions) {
      if (
        ex.exclusionType === "email" &&
        emailVal === ex.exclusionValue.trim().toLowerCase()
      ) {
        return {
          suppressed: true,
          reason: `Sequence exclusion rule: specific email ${ex.exclusionValue}`,
        };
      }
      if (
        ex.exclusionType === "domain" &&
        domainVal === ex.exclusionValue.trim().toLowerCase()
      ) {
        return {
          suppressed: true,
          reason: `Sequence exclusion rule: email domain ${ex.exclusionValue}`,
        };
      }
      if (
        ex.exclusionType === "segment" &&
        recordSegments.includes(ex.exclusionValue)
      ) {
        return {
          suppressed: true,
          reason: `Sequence exclusion rule: member of excluded segment ${ex.exclusionValue}`,
        };
      }
    }
  }

  return { suppressed: false, reason: null };
}

export function calculateLinkEngagementAnalytics(
  params: LinkEngagementInput,
): LinkEngagementResult {
  const {
    clicks,
    trackers,
    activities,
    activityLinks,
    memberships,
    steps,
    sequenceId,
  } = params;

  const seqMemberships = memberships.filter((m) => m.sequenceId === sequenceId);
  const seqSteps = steps.filter((s) => s.sequenceId === sequenceId);

  const trackerToActivity = new Map<string, string>();
  for (const t of trackers) {
    trackerToActivity.set(t.id, t.activityId);
  }

  const activityToStep = new Map<string, { id: string; name: string }>();

  for (const m of seqMemberships) {
    const linksForRecord = activityLinks.filter(
      (link) =>
        link.targetId === m.recordId &&
        (link.targetType === "Lead" || link.targetType === "Contact"),
    );
    const activityIds = linksForRecord.map((l) => l.activityId);
    const emailActs = activities.filter(
      (act) => act.type === "email" && activityIds.includes(act.id),
    );
    emailActs.sort((a, b) => a.id.localeCompare(b.id));

    emailActs.forEach((act, idx) => {
      const stepNum = idx + 1;
      const step = seqSteps.find((s) => s.stepNumber === stepNum);
      if (step) {
        activityToStep.set(act.id, {
          id: step.id,
          name: step.name || `Step ${step.stepNumber}`,
        });
      }
    });
  }

  const performanceMap = new Map<
    string,
    { count: number; stepId: string; stepName: string; clickedUrl: string }
  >();
  let totalTrackedClicks = 0;

  for (const click of clicks) {
    const activityId = trackerToActivity.get(click.trackerId);
    if (activityId) {
      const stepInfo = activityToStep.get(activityId);
      if (stepInfo) {
        const key = `${stepInfo.id}||${click.clickedUrl}`;
        const existing = performanceMap.get(key);
        if (existing) {
          existing.count++;
        } else {
          performanceMap.set(key, {
            count: 1,
            stepId: stepInfo.id,
            stepName: stepInfo.name,
            clickedUrl: click.clickedUrl,
          });
        }
        totalTrackedClicks++;
      }
    }
  }

  const linkPerformance: LinkPerformanceMetric[] = Array.from(
    performanceMap.values(),
  ).map((item) => ({
    clickedUrl: item.clickedUrl,
    stepId: item.stepId,
    stepName: item.stepName,
    clickCount: item.count,
    percentage:
      totalTrackedClicks > 0
        ? `${((item.count / totalTrackedClicks) * 100).toFixed(1)}%`
        : "0.0%",
  }));

  linkPerformance.sort((a, b) => b.clickCount - a.clickCount);

  return {
    totalTrackedClicks,
    linkPerformance,
  };
}

export function calculateRecipientEngagementScore(
  events: EngagementScoreEventsInput,
): number {
  let score = 0;

  // 1. Opens (+1 per event)
  score += events.openCount * 1;

  // 2. Clicks (+3 per event)
  score += events.clickCount * 3;

  // 3. Replies (+10 per event)
  score += events.replyCount * 10;

  // 4. Read times
  for (const event of events.readTimeEvents) {
    if (event.readClassification === "skimmed") {
      score += 2;
    } else if (event.readClassification === "read") {
      score += 5;
    }
  }

  // 5. Bounces & Complaints
  for (const event of events.bounceEvents) {
    if (
      event.eventType === "complaint" ||
      event.bounceType === "spam_complaint"
    ) {
      score -= 10;
    } else if (event.eventType === "bounce") {
      score -= 5;
    }
  }

  // 6. Unsubscribed penalty (-15 points)
  if (events.isUnsubscribed) {
    score -= 15;
  }

  return score;
}

export function validateHexColor(color: string): boolean {
  return /^#[0-9A-Fa-f]{6}$/.test(color);
}

export function detectFolderLoop(
  folderId: string,
  newParentId: string | null,
  allFolders: FolderNode[],
): boolean {
  if (!newParentId) return false;
  if (folderId === newParentId) return true;

  let currentId: string | null = newParentId;
  const visited = new Set<string>();

  while (currentId) {
    if (visited.has(currentId)) {
      return true; // Loop detected
    }
    visited.add(currentId);
    if (currentId === folderId) {
      return true; // Loop through ancestor/descendant detected
    }
    const parentNode = allFolders.find((f) => f.id === currentId);
    currentId = parentNode ? parentNode.parentFolderId : null;
  }
  return false;
}
