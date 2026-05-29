export const CORE_VERSION = "0.1.0";

export interface Organization {
  id: string;
  name: string;
  status: string;
  createdAt: Date;
}

export interface LeadRecord {
  id: string;
  orgId: string;
  ownerId: string;
  status: string;
  email: string | null;
  company: string | null;
  custom: Record<string, unknown> | null;
}

export interface LeadConversionInput {
  lead: LeadRecord;
  opportunityName?: string;
  opportunityAmount?: string;
}

export interface ConvertedEntities {
  account: {
    orgId: string;
    ownerId: string;
    name: string;
    custom: Record<string, unknown> | null;
  };
  contact: {
    orgId: string;
    ownerId: string;
    firstName: string;
    lastName: string;
    email: string | null;
    custom: Record<string, unknown> | null;
  };
  opportunity?: {
    orgId: string;
    ownerId: string;
    stage: string;
    name: string;
    amount: string | null;
    custom: Record<string, unknown> | null;
  };
}

// convertLead is a pure function that processes lead conversion mapping
export function convertLead(input: LeadConversionInput): ConvertedEntities {
  const { lead, opportunityName, opportunityAmount } = input;

  const accountName = lead.company || `${lead.email || "Unknown"}'s Account`;

  const emailParts = lead.email
    ? lead.email.split("@")[0].split(".")
    : ["Unknown"];
  const firstName = emailParts[0] || "Unknown";
  const lastName = emailParts[1] || "Contact";

  const entities: ConvertedEntities = {
    account: {
      orgId: lead.orgId,
      ownerId: lead.ownerId,
      name: accountName,
      custom: lead.custom,
    },
    contact: {
      orgId: lead.orgId,
      ownerId: lead.ownerId,
      firstName,
      lastName,
      email: lead.email,
      custom: null,
    },
  };

  if (opportunityName) {
    entities.opportunity = {
      orgId: lead.orgId,
      ownerId: lead.ownerId,
      stage: "Qualification",
      name: opportunityName,
      amount: opportunityAmount || null,
      custom: null,
    };
  }

  return entities;
}

export interface LineItemInput {
  totalPrice: string;
}

export function rollupOpportunityAmount(items: LineItemInput[]): string {
  const sum = items.reduce(
    (acc, item) => acc + (Number.parseFloat(item.totalPrice) || 0),
    0,
  );
  return String(sum);
}

export interface KanbanStageSummary {
  stage: string;
  opportunitiesCount: number;
  totalValue: string;
  opportunities: {
    id: string;
    name: string;
    amount: string | null;
    closeDate: Date | null;
    accountId: string | null;
  }[];
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

export interface ProRateInput {
  unitPrice: string;
  quantity: number;
  daysUsed: number;
  daysInPeriod: number;
}

export function calculateProRatedAmount(input: ProRateInput): string {
  const price = Number.parseFloat(input.unitPrice) || 0;
  const rawAmount =
    price * input.quantity * (input.daysUsed / input.daysInPeriod);
  return rawAmount.toFixed(2);
}

export interface DiscountTier {
  minQuantity: number;
  discountPercentage: number;
}

export interface CPQProductConfig {
  unitPrice: string;
  quantity: number;
  discountTiers?: DiscountTier[];
  customDiscountPercentage?: number;
}

export interface CPQPriceCalculation {
  subtotal: string;
  discountAmount: string;
  totalPrice: string;
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

export interface EmailLogInput {
  from: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  body: string;
}

export function validateEmailLogInput(input: EmailLogInput): {
  success: boolean;
  error?: string;
} {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!input.from || !emailRegex.test(input.from)) {
    return { success: false, error: "Invalid 'from' email format." };
  }
  if (!Array.isArray(input.to) || input.to.length === 0) {
    return { success: false, error: "'to' must be a non-empty array." };
  }
  for (const email of input.to) {
    if (!email || !emailRegex.test(email)) {
      return { success: false, error: `Invalid 'to' email address: ${email}` };
    }
  }
  if (input.cc) {
    for (const email of input.cc) {
      if (!email || !emailRegex.test(email)) {
        return {
          success: false,
          error: `Invalid 'cc' email address: ${email}`,
        };
      }
    }
  }
  if (input.bcc) {
    for (const email of input.bcc) {
      if (!email || !emailRegex.test(email)) {
        return {
          success: false,
          error: `Invalid 'bcc' email address: ${email}`,
        };
      }
    }
  }
  if (!input.subject || input.subject.trim() === "") {
    return { success: false, error: "'subject' is required." };
  }
  if (!input.body || input.body.trim() === "") {
    return { success: false, error: "'body' is required." };
  }
  return { success: true };
}

export interface OpportunityRecord {
  id: string;
  orgId: string;
  stage: string;
  amount: string | null;
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

export interface CommissionCalculationInput {
  opportunityAmount: string;
  opportunityStage: string;
  quotaTarget: string | null;
  currentClosedWonTotal: string;
  baseRate?: string;
}

export interface CommissionResult {
  commissionAmount: string;
  attainmentPercentage: number;
  rateApplied: string;
  multiplierApplied: number;
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

export interface CriteriaCondition {
  field: string;
  operator: "equals" | "contains" | "greater_than" | "less_than";
  value: string;
}

export interface RuleEntryInput {
  id: string;
  sortOrder: number;
  routingMethod: string;
  routingUserIds: string[];
  lastAssignedIndex: number;
  criteria: CriteriaCondition[];
}

export interface RoutingMatchResult {
  matchedEntryId: string;
  newOwnerId: string;
  newLastAssignedIndex: number;
}

export function evaluateLeadAssignment(
  lead: Record<string, unknown>,
  entries: RuleEntryInput[],
): RoutingMatchResult | null {
  const sortedEntries = [...entries].sort((a, b) => a.sortOrder - b.sortOrder);

  for (const entry of sortedEntries) {
    let match = true;
    for (const cond of entry.criteria) {
      let leadValue: unknown = undefined;
      if (cond.field.startsWith("custom.")) {
        const customField = cond.field.substring("custom.".length);
        leadValue = (lead.custom as Record<string, unknown> | null)?.[
          customField
        ];
      } else {
        leadValue = lead[cond.field];
      }

      if (leadValue === undefined || leadValue === null) {
        match = false;
        break;
      }

      const lStr = String(leadValue).toLowerCase();
      const cStr = String(cond.value).toLowerCase();

      if (cond.operator === "equals") {
        if (lStr !== cStr) {
          match = false;
          break;
        }
      } else if (cond.operator === "contains") {
        if (!lStr.includes(cStr)) {
          match = false;
          break;
        }
      } else if (cond.operator === "greater_than") {
        const lNum = Number.parseFloat(lStr);
        const cNum = Number.parseFloat(cStr);
        if (Number.isNaN(lNum) || Number.isNaN(cNum) || lNum <= cNum) {
          match = false;
          break;
        }
      } else if (cond.operator === "less_than") {
        const lNum = Number.parseFloat(lStr);
        const cNum = Number.parseFloat(cStr);
        if (Number.isNaN(lNum) || Number.isNaN(cNum) || lNum >= cNum) {
          match = false;
          break;
        }
      } else {
        match = false;
        break;
      }
    }

    if (match && entry.routingUserIds.length > 0) {
      if (entry.routingMethod === "direct") {
        return {
          matchedEntryId: entry.id,
          newOwnerId: entry.routingUserIds[0],
          newLastAssignedIndex: -1,
        };
      }
      if (entry.routingMethod === "round_robin") {
        const nextIndex =
          (entry.lastAssignedIndex + 1) % entry.routingUserIds.length;
        return {
          matchedEntryId: entry.id,
          newOwnerId: entry.routingUserIds[nextIndex],
          newLastAssignedIndex: nextIndex,
        };
      }
    }
  }

  return null;
}

export interface TerritoryCriteriaCondition {
  field: string;
  operator: "equals" | "contains" | "greater_than" | "less_than";
  value: string;
}

export interface TerritoryInput {
  id: string;
  name: string;
  isActive: number;
  routingMethod: string;
  lastAssignedIndex: number;
  criteria: TerritoryCriteriaCondition[];
}

export interface TerritoryMemberInput {
  id: string;
  territoryId: string;
  userId: string;
  role: string;
}

export interface TerritoryMatchResult {
  matchedTerritoryId: string;
  newOwnerId: string | null;
  newLastAssignedIndex: number;
}

export function evaluateTerritoryRouting(
  account: Record<string, unknown>,
  territories: TerritoryInput[],
  members: TerritoryMemberInput[],
): TerritoryMatchResult | null {
  const activeTerritories = territories.filter((t) => t.isActive === 1);

  for (const territory of activeTerritories) {
    let match = true;
    for (const cond of territory.criteria) {
      let val: unknown = undefined;
      if (cond.field.startsWith("custom.")) {
        const customField = cond.field.substring("custom.".length);
        val = (account.custom as Record<string, unknown> | null)?.[customField];
      } else {
        val = account[cond.field];
      }

      if (val === undefined || val === null) {
        match = false;
        break;
      }

      const valStr = String(val).toLowerCase();
      const condStr = String(cond.value).toLowerCase();

      if (cond.operator === "equals") {
        if (valStr !== condStr) {
          match = false;
          break;
        }
      } else if (cond.operator === "contains") {
        if (!valStr.includes(condStr)) {
          match = false;
          break;
        }
      } else if (cond.operator === "greater_than") {
        const vNum = Number.parseFloat(valStr);
        const cNum = Number.parseFloat(condStr);
        if (Number.isNaN(vNum) || Number.isNaN(cNum) || vNum <= cNum) {
          match = false;
          break;
        }
      } else if (cond.operator === "less_than") {
        const vNum = Number.parseFloat(valStr);
        const cNum = Number.parseFloat(condStr);
        if (Number.isNaN(vNum) || Number.isNaN(cNum) || vNum >= cNum) {
          match = false;
          break;
        }
      } else {
        match = false;
        break;
      }
    }

    if (match) {
      const primaryMembers = members.filter(
        (m) => m.territoryId === territory.id && m.role === "Primary",
      );

      if (primaryMembers.length === 0) {
        return {
          matchedTerritoryId: territory.id,
          newOwnerId: null,
          newLastAssignedIndex: -1,
        };
      }

      if (territory.routingMethod === "direct") {
        return {
          matchedTerritoryId: territory.id,
          newOwnerId: primaryMembers[0].userId,
          newLastAssignedIndex: -1,
        };
      }

      if (territory.routingMethod === "round_robin") {
        const nextIndex =
          (territory.lastAssignedIndex + 1) % primaryMembers.length;
        return {
          matchedTerritoryId: territory.id,
          newOwnerId: primaryMembers[nextIndex].userId,
          newLastAssignedIndex: nextIndex,
        };
      }
    }
  }

  return null;
}

export interface SplitInput {
  userId: string;
  percentage: number;
}

export interface SplitResult {
  userId: string;
  percentage: number;
  splitAmount: string;
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

export interface CampaignStatsInput {
  budgetedCost: string;
  actualCost: string;
  expectedRevenue: string;
  members: { status: string }[];
  opportunities: { stage: string; amount: string | null }[];
}

export interface CampaignStatsResult {
  totalMembers: number;
  respondedMembers: number;
  responseRate: number;
  totalClosedWonRevenue: string;
  netRevenueRoi: string;
}

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

export interface StageHistoryInput {
  opportunityId: string;
  fromStage: string | null;
  toStage: string;
  createdAt: Date;
}

export interface StageDuration {
  stage: string;
  totalDurationMs: number;
  transitionCount: number;
  averageDurationDays: number;
}

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

export type FieldResolutionSource = "master" | "duplicate";

export interface MergeLeadsInput {
  master: LeadRecord;
  duplicate: LeadRecord;
  fieldResolution: Record<string, FieldResolutionSource>;
}

export function calculateLeadDuplicates(
  sourceLead: LeadRecord,
  allLeads: LeadRecord[],
): LeadRecord[] {
  if (!sourceLead.orgId) return [];

  const publicDomains = new Set([
    "gmail.com",
    "yahoo.com",
    "outlook.com",
    "hotmail.com",
    "aol.com",
    "icloud.com",
    "zoho.com",
    "proton.me",
    "mail.com",
  ]);

  const getEmailDomain = (email: string | null): string | null => {
    if (!email) return null;
    const parts = email.trim().toLowerCase().split("@");
    if (parts.length < 2) return null;
    return parts[1];
  };

  const cleanString = (val: string | null): string => {
    return val ? val.trim().toLowerCase() : "";
  };

  const sourceEmail = cleanString(sourceLead.email);
  const sourceCompany = cleanString(sourceLead.company);
  const sourceDomain = getEmailDomain(sourceLead.email);

  return allLeads.filter((lead) => {
    // 1. Same active organization
    if (lead.orgId !== sourceLead.orgId) return false;
    // 2. Different ID
    if (lead.id === sourceLead.id) return false;

    const leadEmail = cleanString(lead.email);
    const leadCompany = cleanString(lead.company);
    const leadDomain = getEmailDomain(lead.email);

    // Rule A: Exact email match
    if (sourceEmail && leadEmail && sourceEmail === leadEmail) {
      return true;
    }

    // Rule B: Company match AND same non-public email domain
    if (
      sourceCompany &&
      leadCompany &&
      sourceCompany === leadCompany &&
      sourceDomain &&
      leadDomain &&
      sourceDomain === leadDomain &&
      !publicDomains.has(sourceDomain)
    ) {
      return true;
    }

    return false;
  });
}

export function mergeLeads(input: MergeLeadsInput): LeadRecord {
  const { master, duplicate, fieldResolution } = input;

  if (master.orgId !== duplicate.orgId) {
    throw new Error("Cannot merge leads from different organizations.");
  }

  const resolveField = <T>(
    fieldName: string,
    masterValue: T,
    duplicateValue: T,
  ): T => {
    const source = fieldResolution[fieldName];
    if (source === "duplicate") {
      return duplicateValue;
    }
    return masterValue;
  };

  const email = resolveField("email", master.email, duplicate.email);
  const company = resolveField("company", master.company, duplicate.company);
  const status = resolveField("status", master.status, duplicate.status);

  // Merge custom JSONB attributes
  const custom: Record<string, unknown> = {};

  const masterCustom = master.custom || {};
  const duplicateCustom = duplicate.custom || {};

  const allCustomKeys = new Set([
    ...Object.keys(masterCustom),
    ...Object.keys(duplicateCustom),
  ]);

  for (const key of allCustomKeys) {
    const masterVal = masterCustom[key];
    const duplicateVal = duplicateCustom[key];

    if (key in masterCustom && !(key in duplicateCustom)) {
      custom[key] = masterVal;
    } else if (!(key in masterCustom) && key in duplicateCustom) {
      custom[key] = duplicateVal;
    } else {
      // Key is in both: resolve based on "custom.key" or generic master/duplicate resolution
      const resolutionKey = `custom.${key}`;
      const source =
        fieldResolution[resolutionKey] || fieldResolution.custom || "master";
      custom[key] = source === "duplicate" ? duplicateVal : masterVal;
    }
  }

  return {
    id: master.id,
    orgId: master.orgId,
    ownerId: master.ownerId,
    status,
    email,
    company,
    custom: Object.keys(custom).length > 0 ? custom : null,
  };
}

export interface DBOpportunityContactRole {
  id: string;
  orgId: string;
  opportunityId: string;
  contactId: string;
  role: string;
  isPrimary: boolean;
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

export interface CampaignInfluenceInput {
  campaignId: string;
  opportunityId: string;
  influencePercentage: number;
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

export interface ContractRecord {
  id: string;
  orgId: string;
  accountId: string;
  contractAmount: string;
  startDate: Date;
  endDate: Date;
  status: string;
}

export interface RenewalGenerationInput {
  contract: ContractRecord;
  accountName: string;
  escalationPercentage?: number;
}

export interface GeneratedRenewalOpportunity {
  orgId: string;
  accountId: string;
  name: string;
  stage: string;
  amount: string;
  closeDate: Date;
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

export interface SimpleAccountRelation {
  id: string;
  parentAccountId?: string | null;
}

export interface SimpleOpportunityRelation {
  accountId: string | null;
  stage: string;
  amount: string | null;
}

/**
 * Validates whether setting proposedParentId as the parent of targetId
 * would introduce a circular hierarchy cycle.
 */
export function detectCircularAccountRelation(
  accountsList: SimpleAccountRelation[],
  targetId: string,
  proposedParentId: string,
): boolean {
  if (targetId === proposedParentId) return true;

  // Build a lookup map of id -> parentAccountId
  const parentMap = new Map<string, string | null>();
  for (const acct of accountsList) {
    parentMap.set(acct.id, acct.parentAccountId || null);
  }

  // Set the proposed relation in our local lookup map
  parentMap.set(targetId, proposedParentId);

  // Traverse upwards from proposedParentId to see if we ever hit targetId
  let currentId: string | null = proposedParentId;
  const visited = new Set<string>();

  while (currentId) {
    if (visited.has(currentId)) {
      // Internal cycle detected (infinite loop protection)
      return true;
    }
    visited.add(currentId);

    if (currentId === targetId) {
      return true;
    }

    currentId = parentMap.get(currentId) || null;
  }

  return false;
}

/**
 * Aggregates opportunity pipeline values recursively for a parent account and all its children.
 */
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

/**
 * Calculates whether a lead SLA response target has been breached, met, or is still pending.
 */
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

export function validateAccountTeamMember(
  accountId: string,
  userId: string,
  role: string,
): { success: boolean; error?: string } {
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const mockRegex = /^(account|user|team)-[a-z0-9]+$/i;

  if (
    !accountId ||
    (!uuidRegex.test(accountId) && !mockRegex.test(accountId))
  ) {
    return { success: false, error: "Invalid Account ID format." };
  }
  if (!userId || (!uuidRegex.test(userId) && !mockRegex.test(userId))) {
    return { success: false, error: "Invalid User ID format." };
  }
  if (!SUPPORTED_TEAM_ROLES.includes(role)) {
    return {
      success: false,
      error: `Invalid role. Supported roles are: ${SUPPORTED_TEAM_ROLES.join(", ")}`,
    };
  }
  return { success: true };
}

export interface SimpleContactRelation {
  id: string;
  reportsToId?: string | null;
}

export function detectCircularContactRelation(
  contactsList: SimpleContactRelation[],
  targetId: string,
  proposedReportsToId: string,
): boolean {
  if (targetId === proposedReportsToId) return true;

  const reportsToMap = new Map<string, string | null>();
  for (const c of contactsList) {
    reportsToMap.set(c.id, c.reportsToId || null);
  }

  reportsToMap.set(targetId, proposedReportsToId);

  let currentId: string | null = proposedReportsToId;
  const visited = new Set<string>();

  while (currentId) {
    if (visited.has(currentId)) {
      return true;
    }
    visited.add(currentId);

    if (currentId === targetId) {
      return true;
    }

    currentId = reportsToMap.get(currentId) || null;
  }

  return false;
}

export interface ScoringRuleInput {
  id: string;
  isActive: number;
  scoreValue: number;
  criteria: CriteriaCondition[];
}

export function calculateLeadScore(
  lead: Record<string, unknown>,
  rules: ScoringRuleInput[],
): number {
  let score = 0;
  const activeRules = rules.filter((r) => r.isActive === 1);

  for (const rule of activeRules) {
    let match = true;
    for (const cond of rule.criteria) {
      let val: unknown = undefined;
      if (cond.field.startsWith("custom.")) {
        const customField = cond.field.substring("custom.".length);
        val = (lead.custom as Record<string, unknown> | null)?.[customField];
      } else {
        val = lead[cond.field];
      }

      if (val === undefined || val === null) {
        match = false;
        break;
      }

      const valStr = String(val).toLowerCase();
      const condStr = String(cond.value).toLowerCase();

      if (cond.operator === "equals") {
        if (valStr !== condStr) {
          match = false;
          break;
        }
      } else if (cond.operator === "contains") {
        if (!valStr.includes(condStr)) {
          match = false;
          break;
        }
      } else if (cond.operator === "greater_than") {
        const vNum = Number.parseFloat(valStr);
        const cNum = Number.parseFloat(condStr);
        if (Number.isNaN(vNum) || Number.isNaN(cNum) || vNum <= cNum) {
          match = false;
          break;
        }
      } else if (cond.operator === "less_than") {
        const vNum = Number.parseFloat(valStr);
        const cNum = Number.parseFloat(condStr);
        if (Number.isNaN(vNum) || Number.isNaN(cNum) || vNum >= cNum) {
          match = false;
          break;
        }
      } else {
        match = false;
        break;
      }
    }

    if (match) {
      score += rule.scoreValue;
    }
  }

  return score;
}

export interface AccountRecord {
  id: string;
  orgId: string;
  ownerId: string;
  name: string;
  domain: string | null;
  custom: Record<string, unknown> | null;
  parentAccountId?: string | null;
}

export interface MergeAccountsInput {
  master: AccountRecord;
  duplicate: AccountRecord;
  fieldResolution: Record<string, FieldResolutionSource>;
}

export function calculateAccountDuplicates(
  sourceAccount: AccountRecord,
  allAccounts: AccountRecord[],
): AccountRecord[] {
  if (!sourceAccount.orgId) return [];

  const cleanString = (val: string | null): string => {
    return val ? val.trim().toLowerCase() : "";
  };

  const sourceName = cleanString(sourceAccount.name);
  const sourceDomain = cleanString(sourceAccount.domain);

  return allAccounts.filter((acc) => {
    if (acc.orgId !== sourceAccount.orgId) return false;
    if (acc.id === sourceAccount.id) return false;

    const accName = cleanString(acc.name);
    const accDomain = cleanString(acc.domain);

    // Rule A: Exact name match
    if (sourceName && accName && sourceName === accName) {
      return true;
    }

    // Rule B: Exact domain match (if not empty/null)
    if (sourceDomain && accDomain && sourceDomain === accDomain) {
      return true;
    }

    return false;
  });
}

export function mergeAccounts(input: MergeAccountsInput): AccountRecord {
  const { master, duplicate, fieldResolution } = input;

  if (master.orgId !== duplicate.orgId) {
    throw new Error("Cannot merge accounts from different organizations.");
  }

  const resolveField = <T>(
    fieldName: string,
    masterValue: T,
    duplicateValue: T,
  ): T => {
    const source = fieldResolution[fieldName];
    if (source === "duplicate") {
      return duplicateValue;
    }
    return masterValue;
  };

  const name = resolveField("name", master.name, duplicate.name);
  const domain = resolveField("domain", master.domain, duplicate.domain);

  // Merge custom JSONB attributes
  const custom: Record<string, unknown> = {};

  const masterCustom = master.custom || {};
  const duplicateCustom = duplicate.custom || {};

  const allCustomKeys = new Set([
    ...Object.keys(masterCustom),
    ...Object.keys(duplicateCustom),
  ]);

  for (const key of allCustomKeys) {
    const masterVal = masterCustom[key];
    const duplicateVal = duplicateCustom[key];

    if (key in masterCustom && !(key in duplicateCustom)) {
      custom[key] = masterVal;
    } else if (!(key in masterCustom) && key in duplicateCustom) {
      custom[key] = duplicateVal;
    } else {
      // Key is in both: resolve based on "custom.key" or generic master/duplicate resolution
      const resolutionKey = `custom.${key}`;
      const source =
        fieldResolution[resolutionKey] || fieldResolution.custom || "master";
      custom[key] = source === "duplicate" ? duplicateVal : masterVal;
    }
  }

  return {
    id: master.id,
    orgId: master.orgId,
    ownerId: master.ownerId,
    name,
    domain,
    parentAccountId: master.parentAccountId || null,
    custom: Object.keys(custom).length > 0 ? custom : null,
  };
}

export interface ContactRecord {
  id: string;
  orgId: string;
  ownerId: string;
  accountId: string | null;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  custom: Record<string, unknown> | null;
  reportsToId?: string | null;
}

export interface MergeContactsInput {
  master: ContactRecord;
  duplicate: ContactRecord;
  fieldResolution: Record<string, FieldResolutionSource>;
}

export function calculateContactDuplicates(
  sourceContact: ContactRecord,
  allContacts: ContactRecord[],
): ContactRecord[] {
  if (!sourceContact.orgId) return [];

  const cleanString = (val: string | null): string => {
    return val ? val.trim().toLowerCase() : "";
  };

  const sourceEmail = cleanString(sourceContact.email);
  const sourceFirst = cleanString(sourceContact.firstName);
  const sourceLast = cleanString(sourceContact.lastName);

  return allContacts.filter((c) => {
    if (c.orgId !== sourceContact.orgId) return false;
    if (c.id === sourceContact.id) return false;

    const cEmail = cleanString(c.email);
    const cFirst = cleanString(c.firstName);
    const cLast = cleanString(c.lastName);

    // Rule A: Exact email match (if not empty/null)
    if (sourceEmail && cEmail && sourceEmail === cEmail) {
      return true;
    }

    // Rule B: Exact combination of firstName AND lastName match (if both not empty/null)
    if (
      sourceFirst &&
      sourceLast &&
      cFirst &&
      cLast &&
      sourceFirst === cFirst &&
      sourceLast === cLast
    ) {
      return true;
    }

    return false;
  });
}

export function mergeContacts(input: MergeContactsInput): ContactRecord {
  const { master, duplicate, fieldResolution } = input;

  if (master.orgId !== duplicate.orgId) {
    throw new Error("Cannot merge contacts from different organizations.");
  }

  const resolveField = <T>(
    fieldName: string,
    masterValue: T,
    duplicateValue: T,
  ): T => {
    const source = fieldResolution[fieldName];
    if (source === "duplicate") {
      return duplicateValue;
    }
    return masterValue;
  };

  const firstName = resolveField(
    "firstName",
    master.firstName,
    duplicate.firstName,
  );
  const lastName = resolveField(
    "lastName",
    master.lastName,
    duplicate.lastName,
  );
  const email = resolveField("email", master.email, duplicate.email);
  const accountId = resolveField(
    "accountId",
    master.accountId,
    duplicate.accountId,
  );
  const reportsToId = resolveField(
    "reportsToId",
    master.reportsToId,
    duplicate.reportsToId,
  );

  // Merge custom JSONB attributes
  const custom: Record<string, unknown> = {};

  const masterCustom = master.custom || {};
  const duplicateCustom = duplicate.custom || {};

  const allCustomKeys = new Set([
    ...Object.keys(masterCustom),
    ...Object.keys(duplicateCustom),
  ]);

  for (const key of allCustomKeys) {
    const masterVal = masterCustom[key];
    const duplicateVal = duplicateCustom[key];

    if (key in masterCustom && !(key in duplicateCustom)) {
      custom[key] = masterVal;
    } else if (!(key in masterCustom) && key in duplicateCustom) {
      custom[key] = duplicateVal;
    } else {
      // Key is in both: resolve based on "custom.key" or generic master/duplicate resolution
      const resolutionKey = `custom.${key}`;
      const source =
        fieldResolution[resolutionKey] || fieldResolution.custom || "master";
      custom[key] = source === "duplicate" ? duplicateVal : masterVal;
    }
  }

  return {
    id: master.id,
    orgId: master.orgId,
    ownerId: master.ownerId,
    accountId,
    firstName,
    lastName,
    email,
    custom: Object.keys(custom).length > 0 ? custom : null,
    reportsToId,
  };
}

export interface CompetitorInput {
  name: string;
  winLossStatus: string;
}

export interface CompetitorStats {
  competitorCount: number;
  wonCount: number;
  lostCount: number;
  pendingCount: number;
  competitorList: string[];
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

export interface LeadConversionMappingInput {
  sourceLeadField: string;
  targetObjectType: "accounts" | "contacts" | "opportunities";
  targetField: string;
}

export interface ConvertLeadWithMappingsInput {
  lead: LeadRecord;
  opportunityName?: string;
  opportunityAmount?: string;
  mappings: LeadConversionMappingInput[];
}

export function convertLeadWithMappings(
  input: ConvertLeadWithMappingsInput,
): ConvertedEntities {
  const { lead, opportunityName, opportunityAmount, mappings } = input;
  const entities = convertLead({ lead, opportunityName, opportunityAmount });

  for (const mapping of mappings) {
    const { sourceLeadField, targetObjectType, targetField } = mapping;

    let value: unknown = undefined;
    if (sourceLeadField.startsWith("custom.")) {
      const fieldKey = sourceLeadField.substring("custom.".length);
      value = (lead.custom as Record<string, unknown> | null)?.[fieldKey];
    } else {
      value = (lead as unknown as Record<string, unknown>)[sourceLeadField];
    }

    if (value === undefined || value === null) {
      continue;
    }

    const entityKey =
      targetObjectType === "accounts"
        ? "account"
        : targetObjectType === "contacts"
          ? "contact"
          : "opportunity";

    const targetEntity = entities[entityKey];
    if (!targetEntity) {
      continue;
    }

    if (targetField.startsWith("custom.")) {
      const fieldKey = targetField.substring("custom.".length);
      if (!targetEntity.custom) {
        targetEntity.custom = {};
      }
      (targetEntity.custom as Record<string, unknown>)[fieldKey] = value;
    } else {
      (targetEntity as unknown as Record<string, unknown>)[targetField] =
        String(value);
    }
  }

  return entities;
}

export function convertCurrency(
  amount: string,
  fromRate: string,
  toRate: string,
): string {
  const amountVal = Number.parseFloat(amount) || 0;
  const fromR = Number.parseFloat(fromRate) || 1.0;
  const toR = Number.parseFloat(toRate) || 1.0;

  if (fromR <= 0 || toR <= 0) return amountVal.toFixed(2);

  // Convert amount from base currency equivalent and scale
  const baseEquivalent = amountVal * fromR;
  const targetVal = baseEquivalent / toR;

  return targetVal.toFixed(2);
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

export interface StageGateRule {
  targetStage: string;
  field: string;
  operator: string;
  expectedValue: string | null;
  errorMessage: string;
  isActive: boolean;
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
    let rawVal: unknown = undefined;
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

export function validateStageGuidanceKeyFields(
  record: Record<string, unknown>,
  keyFields: string[],
): {
  isClean: boolean;
  missingFields: string[];
} {
  const missingFields: string[] = [];

  for (const field of keyFields) {
    let value: unknown = undefined;

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
  const mockRegex = /^(opportunities|opportunity|opp|user|team)-[a-z0-9]+$/i;

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
    /^(opportunity_products|opportunity-product|opp-prod|schedule|item|line)-[a-z0-9]+$/i;

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

export interface GeneratedSchedule {
  opportunityProductId: string;
  scheduleType: "revenue" | "quantity";
  scheduleDate: Date;
  amount: string;
  description: string;
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

export interface AutoConversionCriteria {
  field: string;
  operator: "equals" | "greater_or_equal" | "less_or_equal";
  value: string | number;
}

export function evaluateLeadAutoConversion(
  lead: { status: string; custom?: Record<string, unknown> | null },
  leadScore: number,
  criteria: AutoConversionCriteria,
): boolean {
  const { field, operator, value } = criteria;
  let leadValue: string | number | undefined;

  if (field === "score") {
    leadValue = leadScore;
  } else if (field === "status") {
    leadValue = lead.status;
  } else if (
    lead.custom &&
    typeof lead.custom === "object" &&
    field in lead.custom
  ) {
    leadValue = lead.custom[field] as string | number;
  }

  if (leadValue === undefined) return false;

  if (operator === "equals") {
    return String(leadValue) === String(value);
  }
  if (operator === "greater_or_equal") {
    return Number(leadValue) >= Number(value);
  }
  if (operator === "less_or_equal") {
    return Number(leadValue) <= Number(value);
  }

  return false;
}

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

export interface CompetitorRecord {
  id: string;
  orgId: string;
  opportunityId: string;
  name: string;
  strength: string | null;
  weakness: string | null;
  winLossStatus: string; // "Pending" | "Won" | "Lost"
}

export interface OpportunityRecord {
  id: string;
  orgId: string;
  stage: string;
  amount: string | null;
}

export interface GlobalCompetitorMetrics {
  name: string;
  totalCompetitions: number;
  wonCount: number;
  lostCount: number;
  winRate: number;
  totalValue: string;
  wonValue: string;
  strengths: string[];
  weaknesses: string[];
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

export interface StalledOpportunityResult {
  opportunityId: string;
  opportunityName: string;
  currentStage: string;
  elapsedDays: number;
  maxDaysAllowed: number;
  amount: string | null;
}

export interface StalledOpportunityOpportunity {
  id: string;
  name: string;
  stage: string;
  amount: string | null;
}

export interface StalledOpportunityStageHistory {
  opportunityId: string;
  toStage: string;
  createdAt: Date;
}

export interface StalledOpportunityStageDurationRule {
  stage: string;
  maxDaysAllowed: number;
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

export interface ConsentPreference {
  recordType: "lead" | "contact";
  recordId: string;
  channel: "email" | "sms" | "phone";
  status: "opt_in" | "opt_out" | "pending";
}

export interface ConsentValidationInput {
  channel: "email" | "sms" | "phone";
  preferences: ConsentPreference[];
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

export interface ExternalEmail {
  externalId: string;
  sender: string;
  recipient: string;
  subject: string;
  body: string;
  receivedAt: Date;
}

export interface ExternalCalendarEvent {
  externalId: string;
  title: string;
  description: string;
  attendees: string[]; // List of attendee email addresses
  eventDate: Date;
}

export interface SyncSimulationInput {
  settings: {
    syncEmails: boolean;
    syncCalendar: boolean;
  };
  externalEmails: ExternalEmail[];
  externalCalendarEvents: ExternalCalendarEvent[];
  existingLeads: { id: string; email: string | null }[];
  existingContacts: { id: string; email: string | null }[];
  existingActivityExternalIds: string[]; // Avoid importing duplicates
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

export interface ESignatureTransitionInput {
  currentStatus: "sent" | "viewed" | "signed" | "declined";
  action: "view" | "sign" | "decline";
}

export interface ESignatureTransitionResult {
  nextStatus: "sent" | "viewed" | "signed" | "declined";
  isCompleted: boolean;
}

export function processESignatureTransition(
  input: ESignatureTransitionInput,
): ESignatureTransitionResult {
  const { currentStatus, action } = input;

  if (currentStatus === "signed" || currentStatus === "declined") {
    throw new Error(`Cannot transition from completed state: ${currentStatus}`);
  }

  if (action === "decline") {
    return { nextStatus: "declined", isCompleted: true };
  }

  if (currentStatus === "sent" && action === "view") {
    return { nextStatus: "viewed", isCompleted: false };
  }

  if (currentStatus === "viewed" && action === "sign") {
    return { nextStatus: "signed", isCompleted: true };
  }

  throw new Error(`Invalid action '${action}' for status '${currentStatus}'`);
}

export function validateSurveyResponse(
  score: number,
  type: "csat" | "nps",
): { isValid: boolean; error?: string } {
  if (!Number.isInteger(score)) {
    return { isValid: false, error: "Score must be an integer." };
  }
  if (type === "csat") {
    if (score < 1 || score > 5) {
      return { isValid: false, error: "CSAT score must be between 1 and 5." };
    }
  } else if (type === "nps") {
    if (score < 0 || score > 10) {
      return { isValid: false, error: "NPS score must be between 0 and 10." };
    }
  } else {
    return { isValid: false, error: "Invalid survey type." };
  }
  return { isValid: true };
}

export interface SurveyMetricsResult {
  count: number;
  averageScore: string;
  scorePercentage: number;
}

export function calculateSurveyMetrics(
  responses: { score: number }[],
  type: "csat" | "nps",
): SurveyMetricsResult {
  const count = responses.length;
  if (count === 0) {
    return {
      count: 0,
      averageScore: "0.00",
      scorePercentage: 0,
    };
  }

  const sum = responses.reduce((acc, curr) => acc + curr.score, 0);
  const averageScore = (sum / count).toFixed(2);

  let scorePercentage = 0;
  if (type === "csat") {
    const satisfied = responses.filter((r) => r.score >= 4).length;
    scorePercentage = Math.round((satisfied / count) * 100 * 100) / 100;
  } else if (type === "nps") {
    const promoters = responses.filter((r) => r.score >= 9).length;
    const detractors = responses.filter((r) => r.score <= 6).length;
    const promoterPct = promoters / count;
    const detractorPct = detractors / count;
    scorePercentage = Math.round((promoterPct - detractorPct) * 100);
  }

  return {
    count,
    averageScore,
    scorePercentage,
  };
}

export function calculateMilestoneDueDate(
  createdAt: Date,
  limitMinutes: number,
): Date {
  return new Date(createdAt.getTime() + limitMinutes * 60 * 1000);
}

export function evaluateMilestoneCompletion(
  targetTime: Date,
  completedAt: Date,
): { isMet: boolean; status: "completed" | "breached" } {
  const isMet = completedAt.getTime() <= targetTime.getTime();
  return {
    isMet,
    status: isMet ? "completed" : "breached",
  };
}

export function validateArticleStatus(status: string): boolean {
  return status === "Draft" || status === "Published";
}

export function incrementArticleViewCount(currentCount: number): number {
  if (currentCount < 0) return 0;
  return currentCount + 1;
}

export interface TicketCommentInput {
  body: string;
}

export function validateTicketCommentInput(input: TicketCommentInput): {
  success: boolean;
  error?: string;
} {
  if (!input.body || input.body.trim() === "") {
    return { success: false, error: "Comment body cannot be empty." };
  }
  return { success: true };
}

export interface TicketTagInput {
  name: string;
  color: string;
}

export function validateTicketTagInput(input: TicketTagInput): {
  success: boolean;
  error?: string;
} {
  if (!input.name || input.name.trim() === "") {
    return { success: false, error: "Tag name cannot be empty." };
  }
  if (input.name.length > 50) {
    return { success: false, error: "Tag name cannot exceed 50 characters." };
  }
  const hexPattern = /^#[0-9A-Fa-f]{6}$/;
  if (!input.color || !hexPattern.test(input.color)) {
    return {
      success: false,
      error:
        "Tag color must be a valid 6-character hex color starting with '#'.",
    };
  }
  return { success: true };
}

export interface TicketAssignmentRuleEntryInput {
  id: string;
  sortOrder: number;
  routingMethod: string;
  routingUserIds: string[];
  lastAssignedIndex: number;
  criteria: CriteriaCondition[];
}

export interface TicketRoutingMatchResult {
  matchedEntryId: string;
  newAssignedToId: string;
  newLastAssignedIndex: number;
}

export function evaluateTicketAssignment(
  ticket: Record<string, unknown>,
  entries: TicketAssignmentRuleEntryInput[],
): TicketRoutingMatchResult | null {
  const sortedEntries = [...entries].sort((a, b) => a.sortOrder - b.sortOrder);

  for (const entry of sortedEntries) {
    let match = true;
    for (const cond of entry.criteria) {
      let ticketValue: unknown = undefined;
      if (cond.field.startsWith("custom.")) {
        const customField = cond.field.substring("custom.".length);
        ticketValue = (ticket.custom as Record<string, unknown> | null)?.[
          customField
        ];
      } else {
        ticketValue = ticket[cond.field];
      }

      if (ticketValue === undefined || ticketValue === null) {
        match = false;
        break;
      }

      const tStr = String(ticketValue).toLowerCase();
      const cStr = String(cond.value).toLowerCase();

      if (cond.operator === "equals") {
        if (tStr !== cStr) {
          match = false;
          break;
        }
      } else if (cond.operator === "contains") {
        if (!tStr.includes(cStr)) {
          match = false;
          break;
        }
      } else if (cond.operator === "greater_than") {
        const tNum = Number.parseFloat(tStr);
        const cNum = Number.parseFloat(cStr);
        if (Number.isNaN(tNum) || Number.isNaN(cNum) || tNum <= cNum) {
          match = false;
          break;
        }
      } else if (cond.operator === "less_than") {
        const tNum = Number.parseFloat(tStr);
        const cNum = Number.parseFloat(cStr);
        if (Number.isNaN(tNum) || Number.isNaN(cNum) || tNum >= cNum) {
          match = false;
          break;
        }
      } else {
        match = false;
        break;
      }
    }

    if (match && entry.routingUserIds.length > 0) {
      if (entry.routingMethod === "direct") {
        return {
          matchedEntryId: entry.id,
          newAssignedToId: entry.routingUserIds[0],
          newLastAssignedIndex: -1,
        };
      }
      if (entry.routingMethod === "round_robin") {
        const nextIndex =
          (entry.lastAssignedIndex + 1) % entry.routingUserIds.length;
        return {
          matchedEntryId: entry.id,
          newAssignedToId: entry.routingUserIds[nextIndex],
          newLastAssignedIndex: nextIndex,
        };
      }
    }
  }

  return null;
}

export interface TicketEscalationRuleInput {
  id: string;
  name: string;
  triggerType: string;
  timeThresholdMinutes: number;
  escalateToId: string;
  newPriority: string | null;
  isActive: number;
}

export interface TicketMilestoneInput {
  id: string;
  milestoneType: string;
  targetTime: Date;
  status: string;
  completedAt: Date | null;
}

export interface TicketEscalationResult {
  ruleId: string;
  escalateToId: string;
  newPriority: string | null;
  reason: string;
}

export function evaluateTicketEscalation(
  ticket: { priority?: string | null; assignedToId: string | null },
  milestones: TicketMilestoneInput[],
  rules: TicketEscalationRuleInput[],
  currentTime: Date = new Date(),
): TicketEscalationResult | null {
  const activeRules = rules.filter((r) => r.isActive === 1);

  for (const rule of activeRules) {
    for (const ms of milestones) {
      // 1. milestone_breached evaluation
      if (rule.triggerType === "milestone_breached") {
        const isBreached =
          ms.status === "breached" ||
          (ms.status === "pending" &&
            currentTime.getTime() > ms.targetTime.getTime());

        if (isBreached) {
          return {
            ruleId: rule.id,
            escalateToId: rule.escalateToId,
            newPriority: rule.newPriority,
            reason: `Milestone [${ms.milestoneType}] has breached its target time of ${ms.targetTime.toISOString()}`,
          };
        }
      }

      // 2. milestone_approaching evaluation
      if (rule.triggerType === "milestone_approaching") {
        if (ms.status === "pending" && !ms.completedAt) {
          const timeDiffMs = ms.targetTime.getTime() - currentTime.getTime();
          const thresholdMs = rule.timeThresholdMinutes * 60 * 1000;

          if (timeDiffMs > 0 && timeDiffMs <= thresholdMs) {
            return {
              ruleId: rule.id,
              escalateToId: rule.escalateToId,
              newPriority: rule.newPriority,
              reason: `Milestone [${ms.milestoneType}] is approaching breach (due in ${Math.round(timeDiffMs / 1000 / 60)} minutes)`,
            };
          }
        }
      }
    }
  }

  return null;
}

export interface TicketMacroInput {
  id: string;
  orgId: string;
  name: string;
  cannedResponse: string;
  updateStatus: string | null;
  updatePriority: string | null;
}

export interface TicketMacroApplyInput {
  ticket: {
    id: string;
    orgId: string;
    status: string;
    priority: string;
  };
  macro: TicketMacroInput;
}

export interface TicketMacroApplyResult {
  updatedStatus: string;
  updatedPriority: string;
  commentBody: string;
  auditMessage: string;
}

export function applyTicketMacro(
  input: TicketMacroApplyInput,
): TicketMacroApplyResult {
  const { ticket, macro } = input;

  if (ticket.orgId !== macro.orgId) {
    throw new Error("RLS Isolation Violation: Tenant mismatch.");
  }

  const updatedStatus = macro.updateStatus || ticket.status;
  const updatedPriority = macro.updatePriority || ticket.priority;

  return {
    updatedStatus,
    updatedPriority,
    commentBody: macro.cannedResponse,
    auditMessage: `Applied macro [${macro.name}]. Status transitioned from '${ticket.status}' to '${updatedStatus}', priority from '${ticket.priority}' to '${updatedPriority}'.`,
  };
}

export interface TicketMacroValidationInput {
  name: string;
  cannedResponse: string;
}

export function validateTicketMacroInput(input: TicketMacroValidationInput): {
  success: boolean;
  error?: string;
} {
  if (!input.name || input.name.trim() === "") {
    return { success: false, error: "Macro name cannot be empty." };
  }
  if (input.name.length > 100) {
    return {
      success: false,
      error: "Macro name cannot exceed 100 characters.",
    };
  }
  if (!input.cannedResponse || input.cannedResponse.trim() === "") {
    return { success: false, error: "Canned response cannot be empty." };
  }
  return { success: true };
}

export interface AgentCSATMetricsInput {
  agentId: string;
  tickets: {
    id: string;
    assignedToId: string | null;
    status: string;
    createdAt: Date;
    resolvedAt?: Date | null;
  }[];
  responses: {
    ticketId: string | null;
    score: number;
  }[];
}

export interface AgentCSATMetricsResult {
  totalTickets: number;
  resolvedTickets: number;
  averageCsat: string;
  satisfactionRate: number;
  averageResolutionTimeMinutes: number;
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

export interface CSATFeedbackInput {
  score: number;
  comment?: string | null;
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

export interface CSVColumnMapping {
  [entityField: string]: string;
}

export interface CSVImportInput {
  entityType: "lead" | "contact";
  csvContent: string;
  mapping: CSVColumnMapping;
  dryRun: boolean;
}

export interface RowValidationError {
  row: number;
  column: string;
  message: string;
}

export interface CSVValidationResult {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  errors: RowValidationError[];
}

export function parseCSV(content: string): string[][] {
  const result: string[][] = [];
  if (!content) return result;

  const lines = content.split(/\r?\n/);
  for (const line of lines) {
    if (!line.trim()) continue;

    const row: string[] = [];
    let inQuotes = false;
    let currentCell = "";

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === "," && !inQuotes) {
        row.push(currentCell.trim());
        currentCell = "";
      } else {
        currentCell += char;
      }
    }
    row.push(currentCell.trim());
    result.push(row);
  }
  return result;
}

export function processCSVImport(
  entityType: "lead" | "contact",
  rows: string[][],
  mapping: CSVColumnMapping,
): { valid: Record<string, unknown>[]; errors: RowValidationError[] } {
  const errors: RowValidationError[] = [];
  const valid: Record<string, unknown>[] = [];

  if (rows.length === 0) {
    return { valid, errors };
  }

  const headers = rows[0].map((h) => h.toLowerCase());
  const dataRows = rows.slice(1);

  const getCellValue = (row: string[], field: string): string | null => {
    const mapVal = mapping[field];
    if (!mapVal) return null;

    if (/^\d+$/.test(mapVal)) {
      const idx = Number.parseInt(mapVal, 10);
      return row[idx] !== undefined ? row[idx] : null;
    }

    const idx = headers.indexOf(mapVal.toLowerCase());
    if (idx !== -1) {
      return row[idx] !== undefined ? row[idx] : null;
    }

    return null;
  };

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i];
    const rowNum = i + 2;

    const record: Record<string, unknown> = {};
    let rowHasError = false;

    if (entityType === "lead") {
      const company = getCellValue(row, "company");
      const email = getCellValue(row, "email");
      const status = getCellValue(row, "status") || "New";

      if (!company && !email) {
        errors.push({
          row: rowNum,
          column: "company/email",
          message: "Either Company or Email is required for Leads.",
        });
        rowHasError = true;
      }

      if (email && !email.includes("@")) {
        errors.push({
          row: rowNum,
          column: "email",
          message: `Invalid email address format: ${email}`,
        });
        rowHasError = true;
      }

      if (!rowHasError) {
        record.company = company || null;
        record.email = email || null;
        record.status = status;
      }
    } else if (entityType === "contact") {
      const firstName = getCellValue(row, "firstName");
      const lastName = getCellValue(row, "lastName");
      const email = getCellValue(row, "email");

      if (!lastName) {
        errors.push({
          row: rowNum,
          column: "lastName",
          message: "Last Name is required for Contacts.",
        });
        rowHasError = true;
      }

      if (email && !email.includes("@")) {
        errors.push({
          row: rowNum,
          column: "email",
          message: `Invalid email address format: ${email}`,
        });
        rowHasError = true;
      }

      if (!rowHasError) {
        record.firstName = firstName || "";
        record.lastName = lastName || "";
        record.email = email || null;
      }
    }

    if (!rowHasError) {
      valid.push(record);
    }
  }

  return { valid, errors };
}

export interface DBSchemaMigration {
  id: string;
  orgId: string;
  version: number;
  name: string;
  appliedAt: Date;
}

export interface DBStoreMigration {
  version: number;
  name: string;
  up: (store: Record<string, unknown[]>, orgId: string) => Promise<void>;
  down: (store: Record<string, unknown[]>, orgId: string) => Promise<void>;
}

export const registeredMigrations: DBStoreMigration[] = [
  {
    version: 1,
    name: "Initialize Default Webhook Status",
    up: async (store: Record<string, unknown[]>, orgId: string) => {
      const webhooks =
        (store.webhooks as { orgId: string; status: string }[] | undefined) ||
        [];
      const tenantWebhooks = webhooks.filter((w) => w.orgId === orgId);
      for (const w of tenantWebhooks) {
        if (!w.status) {
          w.status = "active";
        }
      }
    },
    down: async (store: Record<string, unknown[]>, orgId: string) => {
      const webhooks =
        (store.webhooks as { orgId: string; status: string }[] | undefined) ||
        [];
      const tenantWebhooks = webhooks.filter((w) => w.orgId === orgId);
      for (const w of tenantWebhooks) {
        if (w.status === "active") {
          w.status = "";
        }
      }
    },
  },
  {
    version: 2,
    name: "Initialize Default Opportunity Currencies",
    up: async (store: Record<string, unknown[]>, orgId: string) => {
      const opportunities =
        (store.opportunities as
          | { orgId: string; currencyCode?: string }[]
          | undefined) || [];
      const tenantOpps = opportunities.filter((o) => o.orgId === orgId);
      for (const o of tenantOpps) {
        if (!o.currencyCode) {
          o.currencyCode = "USD";
        }
      }
    },
    down: async (store: Record<string, unknown[]>, orgId: string) => {
      const opportunities =
        (store.opportunities as
          | { orgId: string; currencyCode?: string }[]
          | undefined) || [];
      const tenantOpps = opportunities.filter((o) => o.orgId === orgId);
      for (const o of tenantOpps) {
        if (o.currencyCode === "USD") {
          o.currencyCode = "";
        }
      }
    },
  },
];

export async function runStoreMigrations(
  dbStore: {
    schemaMigrations: {
      findMany: () => Promise<DBSchemaMigration[]>;
      insert: (m: {
        orgId: string;
        version: number;
        name: string;
      }) => Promise<DBSchemaMigration>;
    };
  },
  rawStore: Record<string, unknown[]>,
  orgId: string,
  targetVersion?: number,
): Promise<{ success: boolean; applied: number[]; currentVersion: number }> {
  const appliedMigrations = await dbStore.schemaMigrations.findMany();
  const appliedVersions = new Set(appliedMigrations.map((m) => m.version));

  const pending = registeredMigrations
    .filter((m) => !appliedVersions.has(m.version))
    .filter((m) => targetVersion === undefined || m.version <= targetVersion)
    .sort((a, b) => a.version - b.version);

  const applied: number[] = [];
  for (const migration of pending) {
    await migration.up(rawStore, orgId);
    await dbStore.schemaMigrations.insert({
      orgId,
      version: migration.version,
      name: migration.name,
    });
    applied.push(migration.version);
  }

  const allApplied = await dbStore.schemaMigrations.findMany();
  const currentVersion = allApplied.reduce(
    (max: number, m: DBSchemaMigration) => Math.max(max, amVal(m.version)),
    0,
  );

  function amVal(v: number): number {
    return typeof v === "number" ? v : Number(v) || 0;
  }

  return {
    success: true,
    applied,
    currentVersion,
  };
}

export async function rollbackStoreMigrations(
  dbStore: {
    schemaMigrations: {
      findMany: () => Promise<DBSchemaMigration[]>;
      delete: (id: string) => Promise<boolean>;
    };
  },
  rawStore: Record<string, unknown[]>,
  orgId: string,
  targetVersion: number,
): Promise<{ success: boolean; rolledBack: number[]; currentVersion: number }> {
  const appliedMigrations = await dbStore.schemaMigrations.findMany();

  const toRollback = registeredMigrations
    .filter((m) => appliedMigrations.some((am) => am.version === m.version))
    .filter((m) => m.version > targetVersion)
    .sort((a, b) => b.version - a.version);

  const rolledBack: number[] = [];
  for (const migration of toRollback) {
    await migration.down(rawStore, orgId);
    const am = appliedMigrations.find((x) => x.version === migration.version);
    if (am) {
      await dbStore.schemaMigrations.delete(am.id);
    }
    rolledBack.push(migration.version);
  }

  const allApplied = await dbStore.schemaMigrations.findMany();
  const currentVersion = allApplied.reduce(
    (max: number, m: DBSchemaMigration) => Math.max(max, amVal(m.version)),
    0,
  );

  function amVal(v: number): number {
    return typeof v === "number" ? v : Number(v) || 0;
  }

  return {
    success: true,
    rolledBack,
    currentVersion,
  };
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

export interface CoreScheduledReport {
  id: string;
  orgId: string;
  reportId: string;
  recipientEmail: string;
  frequency: "daily" | "weekly" | "monthly";
  nextRunAt: Date;
  isActive: number;
  createdAt: Date;
}

export interface CoreScheduledReportRun {
  id: string;
  orgId: string;
  scheduledReportId: string;
  status: "success" | "failed";
  errorMessage: string | null;
  runAt: Date;
}

export interface CoreReportRunResult {
  reportName: string;
  groupBy: string;
  aggregateFunc: "count" | "sum" | "avg";
  aggregateField: string | null;
  data: { group: string; value: number }[];
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
  store: Record<string, unknown[]>,
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

function runReportInline(params: {
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

export interface LeaderboardRepInput {
  userId: string;
  userName: string;
}

export interface LeaderboardOpportunityInput {
  id: string;
  ownerId: string;
  stage: string;
  amount: string | null;
  closeDate: Date | null;
}

export interface LeaderboardQuotaInput {
  userId: string;
  period: string;
  targetAmount: string;
}

export interface LeaderboardRepResult {
  userId: string;
  userName: string;
  totalClosedWon: number;
  quotaTarget: number;
  attainmentPercentage: number;
  rank: number;
}

export interface LeaderboardResult {
  period: string;
  leaderboard: LeaderboardRepResult[];
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

export function calculateSalesLeaderboard(params: {
  period: string;
  users: LeaderboardRepInput[];
  opportunities: LeaderboardOpportunityInput[];
  quotas: LeaderboardQuotaInput[];
}): LeaderboardResult {
  const { period, users, opportunities, quotas } = params;

  const closedWonOpps = opportunities.filter((opp) => {
    if (opp.stage !== "Closed Won") return false;
    if (!opp.closeDate) return false;
    const date = new Date(opp.closeDate);
    return isDateInPeriod(date, period);
  });

  const totalsByUserId: Record<string, number> = {};
  for (const opp of closedWonOpps) {
    const amount = Number.parseFloat(opp.amount || "0");
    const parsedAmount = Number.isNaN(amount) ? 0 : amount;
    totalsByUserId[opp.ownerId] =
      (totalsByUserId[opp.ownerId] || 0) + parsedAmount;
  }

  const quotasByUserId: Record<string, number> = {};
  for (const q of quotas) {
    if (q.period === period) {
      const amount = Number.parseFloat(q.targetAmount);
      quotasByUserId[q.userId] = Number.isNaN(amount) ? 0 : amount;
    }
  }

  const leaderboard: LeaderboardRepResult[] = users.map((u) => {
    const totalClosedWon =
      Math.round((totalsByUserId[u.userId] || 0) * 100) / 100;
    const quotaTarget = Math.round((quotasByUserId[u.userId] || 0) * 100) / 100;

    let attainmentPercentage = 0;
    if (quotaTarget > 0) {
      attainmentPercentage =
        Math.round((totalClosedWon / quotaTarget) * 10000) / 100;
    }

    return {
      userId: u.userId,
      userName: u.userName,
      totalClosedWon,
      quotaTarget,
      attainmentPercentage,
      rank: 0,
    };
  });

  leaderboard.sort((a, b) => {
    if (b.attainmentPercentage !== a.attainmentPercentage) {
      return b.attainmentPercentage - a.attainmentPercentage;
    }
    return b.totalClosedWon - a.totalClosedWon;
  });

  for (let i = 0; i < leaderboard.length; i++) {
    leaderboard[i].rank = i + 1;
  }

  return {
    period,
    leaderboard,
  };
}

export interface ForecastAdjustmentInput {
  userId: string;
  period: string;
  amount: string;
  adjustmentType: string;
}

export interface AdjustedForecastSummaryResult {
  period: string;
  baseQuota: number;
  adjustedQuota: number;
  baseWeightedAmount: number;
  adjustedWeightedAmount: number;
  baseAttainment: number;
  adjustedAttainment: number;
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

function getFieldValue(fields: Record<string, unknown>, path: string): unknown {
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
    if (!allowedOptions || !allowedOptions.includes(dependentValStr)) {
      return {
        success: false,
        error: `Value '${dependentValStr}' is not allowed for dependent field '${dep.dependentField}' when parent field '${dep.parentField}' is '${parentValStr}'. Allowed values are: ${allowedOptions ? allowedOptions.join(", ") : "none"}.`,
      };
    }
  }

  return { success: true };
}

export interface ValidationRuleInput {
  id: string;
  orgId: string;
  name: string;
  objectType: string;
  errorMessage: string;
  criteria: {
    field: string;
    operator:
      | "equals"
      | "not_equal"
      | "contains"
      | "greater_than"
      | "less_than";
    value: string;
  }[];
  isActive: number;
}

export function validateCustomValidationRules(
  fields: Record<string, unknown>,
  rules: ValidationRuleInput[],
): { success: boolean; error?: string } {
  for (const rule of rules) {
    if (rule.isActive !== 1) continue;

    let match = true;
    for (const cond of rule.criteria) {
      const recordValue = getFieldValue(fields, cond.field);

      if (recordValue === undefined || recordValue === null) {
        match = false;
        break;
      }

      const lStr = String(recordValue).toLowerCase();
      const cStr = String(cond.value).toLowerCase();

      if (cond.operator === "equals") {
        if (lStr !== cStr) {
          match = false;
          break;
        }
      } else if (cond.operator === "not_equal") {
        if (lStr === cStr) {
          match = false;
          break;
        }
      } else if (cond.operator === "contains") {
        if (!lStr.includes(cStr)) {
          match = false;
          break;
        }
      } else if (cond.operator === "greater_than") {
        const lNum = Number.parseFloat(lStr);
        const cNum = Number.parseFloat(cStr);
        if (Number.isNaN(lNum) || Number.isNaN(cNum) || lNum <= cNum) {
          match = false;
          break;
        }
      } else if (cond.operator === "less_than") {
        const lNum = Number.parseFloat(lStr);
        const cNum = Number.parseFloat(cStr);
        if (Number.isNaN(lNum) || Number.isNaN(cNum) || lNum >= cNum) {
          match = false;
          break;
        }
      } else {
        match = false;
        break;
      }
    }

    if (match && rule.criteria.length > 0) {
      return {
        success: false,
        error: rule.errorMessage,
      };
    }
  }

  return { success: true };
}

export interface EmailTemplateInput {
  subject: string;
  body: string;
}

export function compileEmailTemplate(
  template: EmailTemplateInput,
  context: {
    lead?: Record<string, unknown> | null;
    account?: Record<string, unknown> | null;
    contact?: Record<string, unknown> | null;
    opportunity?: Record<string, unknown> | null;
  },
): { subject: string; body: string } {
  const replacePlaceholders = (text: string): string => {
    return text.replace(/\{\{([A-Za-z0-9.]+)\}\}/g, (match, path: string) => {
      const parts = path.split(".");
      if (parts.length < 2) return match;

      const objName = parts[0].toLowerCase();
      const fieldPath = parts.slice(1).join(".");

      let record: Record<string, unknown> | undefined;
      if (objName === "lead") {
        record = (context.lead || undefined) as
          | Record<string, unknown>
          | undefined;
      } else if (objName === "account") {
        record = (context.account || undefined) as
          | Record<string, unknown>
          | undefined;
      } else if (objName === "contact") {
        record = (context.contact || undefined) as
          | Record<string, unknown>
          | undefined;
      } else if (objName === "opportunity") {
        record = (context.opportunity || undefined) as
          | Record<string, unknown>
          | undefined;
      }

      if (!record) return "";

      const val = getFieldValue(record, fieldPath);
      if (val === undefined || val === null) return "";

      return String(val);
    });
  };

  return {
    subject: replacePlaceholders(template.subject),
    body: replacePlaceholders(template.body),
  };
}

interface CoreSequenceStep {
  id: string;
  orgId: string;
  sequenceId: string;
  stepNumber: number;
  delayDays: number;
  templateId: string;
  createdAt: Date;
  updatedAt: Date;
}

interface CoreSequenceMembership {
  id: string;
  orgId: string;
  sequenceId: string;
  recordType: "lead" | "contact";
  recordId: string;
  status: string;
  currentStepNumber: number;
  lastExecutedAt: Date | null;
  nextExecutionAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

interface CoreConsentPreference {
  id: string;
  orgId: string;
  recordType: string;
  recordId: string;
  channel: string;
  status: string;
  source: string;
  updatedById: string;
}

export interface CoreExitTrigger {
  id: string;
  orgId: string;
  sequenceId: string;
  triggerType: string;
  criteria: Record<string, unknown>;
  isActive: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CoreStepSplitTest {
  id: string;
  orgId: string;
  stepId: string;
  variantTemplateId: string;
  splitWeight: number;
  isActive: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CoreAbAllocation {
  id: string;
  orgId: string;
  membershipId: string;
  stepId: string;
  allocatedTemplateId: string;
  createdAt: Date;
}

export function shouldExitSequence(params: {
  recordType: "lead" | "contact";
  lead: Record<string, unknown> | null | undefined;
  opportunities: Record<string, unknown>[];
  triggers: CoreExitTrigger[];
}): boolean {
  for (const trigger of params.triggers) {
    if (trigger.isActive !== 1) continue;

    if (
      trigger.triggerType === "lead_status_changed" &&
      params.recordType === "lead" &&
      params.lead
    ) {
      const targetStatus = trigger.criteria?.status;
      if (targetStatus && params.lead.status === targetStatus) {
        return true;
      }
    }

    if (
      trigger.triggerType === "opportunity_stage_changed" &&
      params.recordType === "contact"
    ) {
      const targetStage = trigger.criteria?.stage;
      if (targetStage) {
        const hasMatchingOpp = params.opportunities.some(
          (opp) => opp.stage === targetStage,
        );
        if (hasMatchingOpp) {
          return true;
        }
      }
    }
  }
  return false;
}

export async function enrollInSequence(
  dbStore: {
    marketingSequenceSteps: {
      findForSequence: (sequenceId: string) => Promise<CoreSequenceStep[]>;
    };
    marketingSequenceMemberships: {
      insert: (
        item: Omit<CoreSequenceMembership, "id" | "createdAt" | "updatedAt">,
      ) => Promise<CoreSequenceMembership>;
    };
  },
  orgId: string,
  sequenceId: string,
  recordType: "lead" | "contact",
  recordId: string,
): Promise<CoreSequenceMembership> {
  const steps =
    await dbStore.marketingSequenceSteps.findForSequence(sequenceId);
  const firstStep = steps.find((s) => s.stepNumber === 1);
  const delay = firstStep ? firstStep.delayDays : 0;

  // Compute nextExecutionAt: delay represented in days
  const nextExecutionAt = new Date(Date.now() + delay * 24 * 60 * 60 * 1000);

  const membership = await dbStore.marketingSequenceMemberships.insert({
    orgId,
    sequenceId,
    recordType,
    recordId,
    status: "active",
    currentStepNumber: 0,
    lastExecutedAt: null,
    nextExecutionAt,
  });

  return membership;
}

export async function executePendingSequenceSteps(
  dbStore: {
    marketingSequenceMemberships: {
      findMany: () => Promise<CoreSequenceMembership[]>;
      update: (
        id: string,
        updates: Partial<
          Omit<
            CoreSequenceMembership,
            "id" | "orgId" | "createdAt" | "updatedAt"
          >
        >,
      ) => Promise<CoreSequenceMembership | null>;
    };
    marketingSequenceSteps: {
      findForSequence: (sequenceId: string) => Promise<CoreSequenceStep[]>;
    };
    leads: {
      findOne: (id: string) => Promise<unknown | null>;
    };
    contacts: {
      findOne: (id: string) => Promise<unknown | null>;
    };
    contactConsentPreferences: {
      findMany: () => Promise<CoreConsentPreference[]>;
    };
    emailTemplates: {
      findOne: (id: string) => Promise<{
        id: string;
        orgId: string;
        name: string;
        subject: string;
        body: string;
      } | null>;
    };
    activities: {
      insert: (item: {
        orgId: string;
        creatorId: string;
        type: "email" | "task" | "call" | "note";
        subject: string;
        body: string;
        dueDate: Date | null;
      }) => Promise<{ id: string }>;
    };
    activityLinks: {
      insert: (item: {
        orgId: string;
        activityId: string;
        targetType: "Lead" | "Account" | "Contact" | "Opportunity" | "Campaign";
        targetId: string;
      }) => Promise<unknown>;
    };
    auditLogs: {
      insert: (item: {
        orgId: string;
        recordId: string;
        recordType: string;
        action: string;
        userId: string;
        changes: Record<string, { before: unknown; after: unknown }>;
      }) => Promise<unknown>;
    };
    marketingSequenceExitTriggers?: {
      findForSequence: (sequenceId: string) => Promise<CoreExitTrigger[]>;
    };
    opportunities?: {
      findMany: () => Promise<unknown[]>;
    };
    marketingSequenceStepSplitTests?: {
      findForStep: (stepId: string) => Promise<CoreStepSplitTest | null>;
    };
    marketingSequenceAbAllocations?: {
      findForMemberAndStep: (
        membershipId: string,
        stepId: string,
      ) => Promise<CoreAbAllocation | null>;
      insert: (item: {
        orgId: string;
        membershipId: string;
        stepId: string;
        allocatedTemplateId: string;
      }) => Promise<CoreAbAllocation>;
    };
  },
  currentTime: Date = new Date(),
): Promise<number> {
  const memberships = await dbStore.marketingSequenceMemberships.findMany();
  const pendingMemberships = memberships.filter(
    (m) => m.status === "active" && new Date(m.nextExecutionAt) <= currentTime,
  );

  let processedCount = 0;

  for (const membership of pendingMemberships) {
    const orgId = membership.orgId;
    const nextStepNumber = membership.currentStepNumber + 1;

    const steps = await dbStore.marketingSequenceSteps.findForSequence(
      membership.sequenceId,
    );
    const step = steps.find((s) => s.stepNumber === nextStepNumber);

    if (!step) {
      await dbStore.marketingSequenceMemberships.update(membership.id, {
        status: "completed",
        currentStepNumber: membership.currentStepNumber,
      });
      processedCount++;
      continue;
    }

    let recipientContext: {
      lead?: Record<string, unknown> | null;
      contact?: Record<string, unknown> | null;
    } = {};

    if (membership.recordType === "lead") {
      const lead = await dbStore.leads.findOne(membership.recordId);
      if (lead) {
        recipientContext = { lead: lead as Record<string, unknown> };
      }
    } else if (membership.recordType === "contact") {
      const contact = await dbStore.contacts.findOne(membership.recordId);
      if (contact) {
        recipientContext = { contact: contact as Record<string, unknown> };
      }
    }

    // Evaluate Exit Triggers if the stores are provided
    if (dbStore.marketingSequenceExitTriggers && dbStore.opportunities) {
      const triggers =
        await dbStore.marketingSequenceExitTriggers.findForSequence(
          membership.sequenceId,
        );
      const allOpps = (await dbStore.opportunities.findMany()) as Record<
        string,
        unknown
      >[];
      let relevantOpps: Record<string, unknown>[] = [];
      if (membership.recordType === "contact" && recipientContext.contact) {
        const contactAccountId = (
          recipientContext.contact as Record<string, unknown>
        ).accountId as string | undefined;
        if (contactAccountId) {
          relevantOpps = allOpps.filter(
            (opp) => opp.accountId === contactAccountId,
          );
        }
      }

      if (
        shouldExitSequence({
          recordType: membership.recordType,
          lead: recipientContext.lead,
          opportunities: relevantOpps,
          triggers,
        })
      ) {
        await dbStore.marketingSequenceMemberships.update(membership.id, {
          status: "completed",
        });

        await dbStore.auditLogs.insert({
          orgId,
          recordId: membership.id,
          recordType: "marketing_sequence_memberships",
          action: "exit_trigger_fired",
          userId: "00000000-0000-0000-0000-000000000000",
          changes: {
            status: { before: "active", after: "completed" },
          },
        });

        processedCount++;
        continue;
      }
    }

    const allPrefs = await dbStore.contactConsentPreferences.findMany();
    const existingPref = allPrefs.find(
      (p) =>
        p.recordType === membership.recordType &&
        p.recordId === membership.recordId &&
        p.channel === "email" &&
        p.status === "opt_out",
    );

    if (existingPref) {
      await dbStore.marketingSequenceMemberships.update(membership.id, {
        status: "unsubscribed",
      });

      await dbStore.auditLogs.insert({
        orgId,
        recordId: membership.recordId,
        recordType: "marketing_sequence_memberships",
        action: "unsubscribe_skip",
        userId: "00000000-0000-0000-0000-000000000000",
        changes: {
          status: { before: "active", after: "unsubscribed" },
        },
      });

      processedCount++;
      continue;
    }

    let templateIdToUse = step.templateId;

    if (
      dbStore.marketingSequenceStepSplitTests &&
      dbStore.marketingSequenceAbAllocations
    ) {
      const splitTest =
        await dbStore.marketingSequenceStepSplitTests.findForStep(step.id);
      if (splitTest && splitTest.isActive === 1) {
        const existingAlloc =
          await dbStore.marketingSequenceAbAllocations.findForMemberAndStep(
            membership.id,
            step.id,
          );
        if (existingAlloc) {
          templateIdToUse = existingAlloc.allocatedTemplateId;
        } else {
          const roll = Math.floor(Math.random() * 100) + 1;
          if (roll <= splitTest.splitWeight) {
            templateIdToUse = splitTest.variantTemplateId;
          } else {
            templateIdToUse = step.templateId;
          }
          await dbStore.marketingSequenceAbAllocations.insert({
            orgId,
            membershipId: membership.id,
            stepId: step.id,
            allocatedTemplateId: templateIdToUse,
          });
        }
      }
    }

    const template = await dbStore.emailTemplates.findOne(templateIdToUse);
    if (!template) {
      await dbStore.marketingSequenceMemberships.update(membership.id, {
        status: "error",
      });
      processedCount++;
      continue;
    }

    const compiled = compileEmailTemplate(template, recipientContext);

    const activity = await dbStore.activities.insert({
      orgId,
      creatorId: "00000000-0000-0000-0000-000000000000",
      type: "email",
      subject: compiled.subject,
      body: compiled.body,
      dueDate: null,
    });

    await dbStore.activityLinks.insert({
      orgId,
      activityId: activity.id,
      targetType: membership.recordType === "lead" ? "Lead" : "Contact",
      targetId: membership.recordId,
    });

    // Auto-generate email tracking record for task 0180
    // biome-ignore lint/suspicious/noExplicitAny: emailTrackers check
    if ((dbStore as any).emailTrackers) {
      const trackerToken = `seq-track-${Math.random().toString(36).substring(2, 15)}`;
      // biome-ignore lint/suspicious/noExplicitAny: emailTrackers insert
      await (dbStore as any).emailTrackers.insert({
        orgId,
        activityId: activity.id,
        token: trackerToken,
      });
    }

    const nextStep = steps.find((s) => s.stepNumber === nextStepNumber + 1);
    let nextStatus = "active";
    let nextExecTime = new Date();

    if (!nextStep) {
      nextStatus = "completed";
    } else {
      nextExecTime = new Date(
        currentTime.getTime() + nextStep.delayDays * 24 * 60 * 60 * 1000,
      );
    }

    await dbStore.marketingSequenceMemberships.update(membership.id, {
      status: nextStatus,
      currentStepNumber: nextStepNumber,
      lastExecutedAt: currentTime,
      nextExecutionAt: nextExecTime,
    });

    await dbStore.auditLogs.insert({
      orgId,
      recordId: membership.id,
      recordType: "marketing_sequence_memberships",
      action: "execute_step",
      userId: "00000000-0000-0000-0000-000000000000",
      changes: {
        stepNumber: {
          before: membership.currentStepNumber,
          after: nextStepNumber,
        },
        status: { before: membership.status, after: nextStatus },
      },
    });

    processedCount++;
  }

  return processedCount;
}

export function evaluateSegmentCriteria(
  record: Record<string, unknown>,
  criteria: { field: string; operator: string; value: string }[],
): boolean {
  for (const cond of criteria) {
    let val: unknown = undefined;
    if (cond.field.startsWith("custom.")) {
      const customField = cond.field.substring("custom.".length);
      val = (record.custom as Record<string, unknown> | null)?.[customField];
    } else {
      val = record[cond.field];
    }

    if (val === undefined || val === null) {
      return false;
    }

    const valStr = String(val).toLowerCase();
    const condStr = String(cond.value).toLowerCase();

    if (cond.operator === "equals") {
      if (valStr !== condStr) return false;
    } else if (cond.operator === "not_equal") {
      if (valStr === condStr) return false;
    } else if (cond.operator === "contains") {
      if (!valStr.includes(condStr)) return false;
    } else if (cond.operator === "greater_than") {
      const vNum = Number.parseFloat(valStr);
      const cNum = Number.parseFloat(condStr);
      if (Number.isNaN(vNum) || Number.isNaN(cNum) || vNum <= cNum)
        return false;
    } else if (cond.operator === "less_than") {
      const vNum = Number.parseFloat(valStr);
      const cNum = Number.parseFloat(condStr);
      if (Number.isNaN(vNum) || Number.isNaN(cNum) || vNum >= cNum)
        return false;
    } else {
      return false;
    }
  }
  return true;
}

export async function resolveSegmentMembers(
  // biome-ignore lint/suspicious/noExplicitAny: dbStore dynamic reference
  db: any,
  tenantOrgId: string,
  segmentId: string,
  // biome-ignore lint/suspicious/noExplicitAny: dynamic return
): Promise<any[]> {
  const segment = await db.marketingSegments.findOne(segmentId);
  if (!segment) {
    throw new Error("Segment not found");
  }

  if (segment.objectType === "lead") {
    const leads = await db.leads.findMany();
    // biome-ignore lint/suspicious/noExplicitAny: lead typecast
    return leads.filter((l: any) =>
      evaluateSegmentCriteria(l, segment.criteria),
    );
  }

  const contacts = await db.contacts.findMany();
  // biome-ignore lint/suspicious/noExplicitAny: contact typecast
  return contacts.filter((c: any) =>
    evaluateSegmentCriteria(c, segment.criteria),
  );
}

export async function enrollSegmentInSequence(
  // biome-ignore lint/suspicious/noExplicitAny: dbStore dynamic reference
  dbStore: any,
  orgId: string,
  segmentId: string,
  sequenceId: string,
): Promise<{
  enrolledCount: number;
  skippedCount: number;
  // biome-ignore lint/suspicious/noExplicitAny: dynamic return
  memberships: any[];
}> {
  const segment = await dbStore.marketingSegments.findOne(segmentId);
  if (!segment) {
    throw new Error("Segment not found");
  }

  const sequence = await dbStore.marketingSequences.findOne(sequenceId);
  if (!sequence) {
    throw new Error("Sequence not found");
  }

  // 1. Resolve segment members
  const members = await resolveSegmentMembers(dbStore, orgId, segmentId);

  // 2. Fetch existing active memberships in target sequence
  const existingMemberships =
    await dbStore.marketingSequenceMemberships.findForSequence(sequenceId);
  const activeRecordIds = new Set(
    existingMemberships
      .filter((m: CoreSequenceMembership) => m.status === "active")
      .map((m: CoreSequenceMembership) => m.recordId),
  );

  // 3. Enroll non-duplicate members
  const newlyEnrolled: CoreSequenceMembership[] = [];
  let skipped = 0;

  for (const member of members) {
    if (activeRecordIds.has(member.id)) {
      skipped++;
      continue;
    }

    const membership = await enrollInSequence(
      dbStore,
      orgId,
      sequenceId,
      segment.objectType as "lead" | "contact",
      member.id,
    );
    newlyEnrolled.push(membership);
  }

  return {
    enrolledCount: newlyEnrolled.length,
    skippedCount: skipped,
    memberships: newlyEnrolled,
  };
}

export interface StepAnalytics {
  stepNumber: number;
  templateId: string;
  sentCount: number;
  openCount: number;
  clickCount: number;
  openRate: string;
  clickRate: string;
}

export interface SequenceAnalyticsResult {
  sequenceId: string;
  totalEnrolled: number;
  statusCounts: {
    active: number;
    completed: number;
    unsubscribed: number;
    error: number;
  };
  overallOpenRate: string;
  overallClickRate: string;
  steps: StepAnalytics[];
}

export function calculateSequenceAnalytics(params: {
  sequenceId: string;
  steps: { id: string; stepNumber: number; templateId: string }[];
  memberships: {
    sequenceId: string;
    status: string;
    currentStepNumber: number;
    recordId: string;
    recordType: string;
  }[];
  activities: { id: string; type: string }[];
  activityLinks: { activityId: string; targetId: string; targetType: string }[];
  emailTrackers: {
    activityId: string;
    openCount: number;
    clickCount: number;
  }[];
}): SequenceAnalyticsResult {
  const {
    sequenceId,
    steps,
    memberships,
    activities,
    activityLinks,
    emailTrackers,
  } = params;

  const seqMemberships = memberships.filter((m) => m.sequenceId === sequenceId);
  const totalEnrolled = seqMemberships.length;

  const statusCounts = {
    active: 0,
    completed: 0,
    unsubscribed: 0,
    error: 0,
  };

  for (const m of seqMemberships) {
    if (m.status === "active") statusCounts.active++;
    else if (m.status === "completed") statusCounts.completed++;
    else if (m.status === "unsubscribed") statusCounts.unsubscribed++;
    else if (m.status === "error") statusCounts.error++;
  }

  const trackerByActivity = new Map<
    string,
    { openCount: number; clickCount: number }
  >();
  for (const tracker of emailTrackers) {
    trackerByActivity.set(tracker.activityId, {
      openCount: tracker.openCount,
      clickCount: tracker.clickCount,
    });
  }

  const stepStats = new Map<
    number,
    { sentCount: number; openCount: number; clickCount: number }
  >();
  for (const step of steps) {
    stepStats.set(step.stepNumber, {
      sentCount: 0,
      openCount: 0,
      clickCount: 0,
    });
  }

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
      const stats = stepStats.get(stepNum);
      if (stats) {
        stats.sentCount++;
        const tracker = trackerByActivity.get(act.id);
        if (tracker) {
          stats.openCount += tracker.openCount;
          stats.clickCount += tracker.clickCount;
        }
      }
    });
  }

  let totalSent = 0;
  let totalOpens = 0;
  let totalClicks = 0;

  const stepAnalyticsList: StepAnalytics[] = steps.map((step) => {
    const stats = stepStats.get(step.stepNumber) || {
      sentCount: 0,
      openCount: 0,
      clickCount: 0,
    };
    totalSent += stats.sentCount;
    totalOpens += stats.openCount;
    totalClicks += stats.clickCount;

    const openRate =
      stats.sentCount > 0
        ? ((stats.openCount / stats.sentCount) * 100).toFixed(2)
        : "0.00";
    const clickRate =
      stats.sentCount > 0
        ? ((stats.clickCount / stats.sentCount) * 100).toFixed(2)
        : "0.00";

    return {
      stepNumber: step.stepNumber,
      templateId: step.templateId,
      sentCount: stats.sentCount,
      openCount: stats.openCount,
      clickCount: stats.clickCount,
      openRate: `${openRate}%`,
      clickRate: `${clickRate}%`,
    };
  });

  const overallOpenRate =
    totalSent > 0 ? ((totalOpens / totalSent) * 100).toFixed(2) : "0.00";
  const overallClickRate =
    totalSent > 0 ? ((totalClicks / totalSent) * 100).toFixed(2) : "0.00";

  return {
    sequenceId,
    totalEnrolled,
    statusCounts,
    overallOpenRate: `${overallOpenRate}%`,
    overallClickRate: `${overallClickRate}%`,
    steps: stepAnalyticsList,
  };
}
