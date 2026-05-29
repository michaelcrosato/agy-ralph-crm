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

export function personalizeEmailTemplate(
  template: EmailTemplateInput,
  context: {
    lead?: Record<string, unknown> | null;
    account?: Record<string, unknown> | null;
    contact?: Record<string, unknown> | null;
    opportunity?: Record<string, unknown> | null;
    globalVariables?: Record<string, string> | null;
  },
): { subject: string; body: string } {
  const resolvePathValue = (path: string): string => {
    const parts = path.split(".");
    if (parts.length < 2) return "";

    const objName = parts[0].toLowerCase();
    const fieldPath = parts.slice(1).join(".");

    if (objName === "global") {
      const val = context.globalVariables?.[fieldPath];
      if (val === undefined || val === null) return "";
      return String(val);
    }

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
  };

  const evalCondition = (path: string): boolean => {
    const val = resolvePathValue(path);
    return val !== "" && val !== "[N/A]" && val !== "false";
  };

  const processText = (text: string): string => {
    if (!text) return "";

    let processed = text;

    // 1. Resolve conditional blocks {% if path %}true{% else %}false{% endif %}
    const ifElseRegex =
      /\{%\s*if\s+([A-Za-z0-9._]+)\s*%\}([\s\S]*?)\{%\s*else\s*%\}([\s\S]*?)\{%\s*endif\s*%\}/g;
    processed = processed.replace(
      ifElseRegex,
      (match, condPath, trueVal, falseVal) => {
        return evalCondition(condPath) ? trueVal : falseVal;
      },
    );

    const ifRegex =
      /\{%\s*if\s+([A-Za-z0-9._]+)\s*%\}([\s\S]*?)\{%\s*endif\s*%\}/g;
    processed = processed.replace(ifRegex, (match, condPath, trueVal) => {
      return evalCondition(condPath) ? trueVal : "";
    });

    // 2. Resolve placeholders {{path.to.field | filter1 | filter2}}
    processed = processed.replace(
      /\{\{\s*([A-Za-z0-9._]+)(?:\s*\|\s*([^}]+))?\s*\}\}/g,
      (match, pathStr: string, filtersStr: string | undefined) => {
        let resolved = resolvePathValue(pathStr);

        if (filtersStr) {
          const filters = filtersStr.split("|").map((f) => f.trim());
          for (const filter of filters) {
            if (filter.startsWith("default")) {
              const defaultMatch = filter.match(/default\((["'])(.*?)\1\)/);
              if (defaultMatch) {
                const fallback = defaultMatch[2];
                if (!resolved || resolved === "[N/A]") {
                  resolved = fallback;
                }
              }
            } else if (filter === "uppercase") {
              resolved = resolved.toUpperCase();
            } else if (filter === "lowercase") {
              resolved = resolved.toLowerCase();
            }
          }
        }

        return resolved;
      },
    );

    return processed;
  };

  return {
    subject: processText(template.subject),
    body: processText(template.body),
  };
}

export function compileEmailTemplate(
  template: EmailTemplateInput,
  context: {
    lead?: Record<string, unknown> | null;
    account?: Record<string, unknown> | null;
    contact?: Record<string, unknown> | null;
    opportunity?: Record<string, unknown> | null;
    globalVariables?: Record<string, string> | null;
  },
): { subject: string; body: string } {
  return personalizeEmailTemplate(template, context);
}

interface CoreSequence {
  id: string;
  orgId: string;
  name: string;
  description: string;
  status: string;
  sendingWindowStart?: string | null;
  sendingWindowEnd?: string | null;
  sendingDays?: number[] | null;
  allowReenrollment?: boolean | null;
  reenrollmentMinDays?: number | null;
  dailySendLimit?: number | null;
  senderType?: string | null;
  senderUserId?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

function getPartsInTimezone(date: Date, tz: string) {
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
      year: Number.parseInt(map.year),
      month: Number.parseInt(map.month),
      day: Number.parseInt(map.day),
      hour: Number.parseInt(map.hour),
      minute: Number.parseInt(map.minute),
      weekday: map.weekday, // "Mon", "Tue", etc.
    };
  } catch (e) {
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

    const localForShift = getPartsInTimezone(target, tz);
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

function parseTimeToMinutes(timeStr: string): number {
  const [hours, minutes] = timeStr.split(":").map(Number);
  return hours * 60 + minutes;
}

export function calculateNextStepExecutionTime(
  currentTime: Date,
  delayDays: number,
  waitCondition?: CoreSequenceStep["waitCondition"],
): Date {
  let target = new Date(
    currentTime.getTime() + delayDays * 24 * 60 * 60 * 1000,
  );

  if (!waitCondition || waitCondition.waitType !== "day_of_week") {
    return target;
  }

  const daysOfWeek = waitCondition.daysOfWeek || [];
  if (daysOfWeek.length === 0) {
    return target;
  }

  let found = false;
  for (let i = 0; i < 7; i++) {
    const day = target.getDay();
    if (daysOfWeek.includes(day)) {
      found = true;
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

interface CoreSequenceStep {
  id: string;
  orgId: string;
  sequenceId: string;
  stepNumber: number;
  delayDays: number;
  templateId: string;
  waitCondition?: {
    waitType: "day_of_week" | "duration";
    daysOfWeek?: number[];
    timeOfDay?: string;
  } | null;
  replyToStepNumber?: number | null;
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
  snoozeUntil: Date | null;
  snoozeReason: string | null;
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
  autoPromoteWinner?: number;
  minSendsToEvaluate?: number;
  evaluationMetric?: string;
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

export interface CoreStepBranch {
  id: string;
  orgId: string;
  stepId: string;
  branchType: string; // "email_open" | "email_click"
  evaluationWindowDays: number;
  trueNextStepNumber: number;
  falseNextStepNumber: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface CoreSequenceGoal {
  id: string;
  orgId: string;
  sequenceId: string;
  goalType: string; // "lead_status_equals" | "opportunity_created"
  targetValue: string | null;
  isActive: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CoreSequenceConversion {
  id: string;
  orgId: string;
  membershipId: string;
  sequenceId: string;
  goalId: string;
  attributedRevenue: string;
  convertedAt: Date;
  createdAt: Date;
}

export interface CoreSequenceSuppression {
  id: string;
  orgId: string;
  recordType: string;
  recordId: string | null;
  pattern: string | null;
  reason: string;
  createdAt: Date;
}

export interface CoreSequenceExclusion {
  id: string;
  orgId: string;
  sequenceId: string;
  exclusionType: string;
  exclusionValue: string;
  createdAt: Date;
  updatedAt: Date;
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

export async function enrollInSequence(
  dbStore: {
    marketingSequenceSteps: {
      findForSequence: (sequenceId: string) => Promise<CoreSequenceStep[]>;
    };
    marketingSequenceMemberships: {
      insert: (
        item: Omit<CoreSequenceMembership, "id" | "createdAt" | "updatedAt">,
      ) => Promise<CoreSequenceMembership>;
      findMany?: () => Promise<CoreSequenceMembership[]>;
    };
    leads?: {
      findOne: (id: string) => Promise<unknown | null>;
    };
    contacts?: {
      findOne: (id: string) => Promise<unknown | null>;
    };
    marketingSequenceSuppressions?: {
      findForOrg: (orgId: string) => Promise<CoreSequenceSuppression[]>;
    };
    marketingSequenceExclusions?: {
      findForSequence: (sequenceId: string) => Promise<CoreSequenceExclusion[]>;
    };
    marketingSegmentMemberships?: {
      findForRecord: (
        recordType: string,
        recordId: string,
      ) => Promise<{ segmentId: string }[]>;
    };
    marketingSequences?: {
      findOne: (id: string) => Promise<CoreSequence | null>;
    };
  },
  orgId: string,
  sequenceId: string,
  recordType: "lead" | "contact",
  recordId: string,
): Promise<CoreSequenceMembership> {
  // Check for existing memberships to enforce active protection, re-enrollment, and frequency limits
  if (dbStore.marketingSequenceMemberships.findMany) {
    const existing = await dbStore.marketingSequenceMemberships.findMany();
    const recipientMemberships = existing.filter(
      (m) =>
        m.sequenceId === sequenceId &&
        m.recordType === recordType &&
        m.recordId === recordId,
    );

    // 1. Prevent overlapping active/snoozed enrollments
    const active = recipientMemberships.find(
      (m) => m.status === "active" || m.status === "snoozed",
    );
    if (active) {
      throw new Error(
        "Recipient is already actively enrolled in this sequence",
      );
    }

    // 2. Enforce re-enrollment rules
    if (dbStore.marketingSequences) {
      const seq = await dbStore.marketingSequences.findOne(sequenceId);
      if (!seq) {
        throw new Error("Sequence not found");
      }
      if (seq.orgId !== orgId) {
        throw new Error("RLS Isolation Violation: Tenant mismatch.");
      }
      if (seq.status === "archived") {
        throw new Error("Cannot enroll in an archived sequence");
      }

      const allowReenroll = seq.allowReenrollment ?? false;
      if (!allowReenroll && recipientMemberships.length > 0) {
        throw new Error("Re-enrollment is not allowed for this sequence");
      }

      if (
        allowReenroll &&
        seq.reenrollmentMinDays &&
        seq.reenrollmentMinDays > 0
      ) {
        const minDays = seq.reenrollmentMinDays;
        const now = Date.now();
        for (const prior of recipientMemberships) {
          const lastActiveTime = prior.updatedAt
            ? new Date(prior.updatedAt).getTime()
            : new Date(prior.createdAt).getTime();
          const elapsedDays = (now - lastActiveTime) / (24 * 60 * 60 * 1000);
          if (elapsedDays < minDays) {
            throw new Error(
              `Frequency cap breached: recipient was recently enrolled and must wait at least ${minDays} days before re-enrolling`,
            );
          }
        }
      }
    }
  }
  let email: string | undefined;
  if (dbStore.leads && recordType === "lead") {
    const lead = (await dbStore.leads.findOne(recordId)) as Record<
      string,
      unknown
    > | null;
    if (!lead) {
      throw new Error("Lead not found");
    }
    email = lead.email as string | undefined;
  } else if (dbStore.contacts && recordType === "contact") {
    const contact = (await dbStore.contacts.findOne(recordId)) as Record<
      string,
      unknown
    > | null;
    if (!contact) {
      throw new Error("Contact not found");
    }
    email = contact.email as string | undefined;
  }

  let isSuppressed = false;
  if (
    dbStore.marketingSequenceSuppressions &&
    dbStore.marketingSequenceExclusions
  ) {
    const suppResult = await isRecordSuppressedOrExcluded({
      orgId,
      sequenceId,
      recordType,
      recordId,
      email,
      // biome-ignore lint/suspicious/noExplicitAny: dbStore type alignment
      dbStore: dbStore as any,
    });
    isSuppressed = suppResult.suppressed;
  }

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
    status: isSuppressed ? "suppressed" : "active",
    currentStepNumber: 0,
    lastExecutedAt: null,
    nextExecutionAt,
    snoozeUntil: null,
    snoozeReason: null,
  });

  return membership;
}

export async function evaluateSequenceGoals(
  dbStore: {
    marketingSequenceGoals?: {
      findForSequence: (sequenceId: string) => Promise<CoreSequenceGoal[]>;
    };
    marketingSequenceConversions?: {
      insert: (item: {
        orgId: string;
        membershipId: string;
        sequenceId: string;
        goalId: string;
        attributedRevenue: string;
        convertedAt: Date;
      }) => Promise<CoreSequenceConversion>;
    };
    marketingSequenceMemberships: {
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
    opportunities?: {
      findMany: () => Promise<unknown[]>;
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
  },
  orgId: string,
  membership: CoreSequenceMembership,
  recipientContext: {
    lead?: Record<string, unknown> | null;
    contact?: Record<string, unknown> | null;
  },
): Promise<boolean> {
  if (
    !dbStore.marketingSequenceGoals ||
    !dbStore.marketingSequenceConversions
  ) {
    return false;
  }

  const goals = await dbStore.marketingSequenceGoals.findForSequence(
    membership.sequenceId,
  );
  const activeGoals = goals.filter((g) => g.isActive === 1);
  if (activeGoals.length === 0) return false;

  for (const goal of activeGoals) {
    let achieved = false;
    let revenue = "0.00";

    if (
      goal.goalType === "lead_status_equals" &&
      membership.recordType === "lead" &&
      recipientContext.lead
    ) {
      if (recipientContext.lead.status === goal.targetValue) {
        achieved = true;
      }
    } else if (goal.goalType === "opportunity_created") {
      if (!dbStore.opportunities) continue;
      const allOpps = (await dbStore.opportunities.findMany()) as Record<
        string,
        unknown
      >[];
      let relevantOpps: Record<string, unknown>[] = [];
      if (membership.recordType === "lead") {
        relevantOpps = allOpps.filter(
          (opp) =>
            (opp.custom as Record<string, unknown> | null)?.sourceLeadId ===
            membership.recordId,
        );
      } else if (
        membership.recordType === "contact" &&
        recipientContext.contact
      ) {
        const contactAccountId = recipientContext.contact.accountId;
        if (contactAccountId) {
          relevantOpps = allOpps.filter(
            (opp) => opp.accountId === contactAccountId,
          );
        }
      }

      if (relevantOpps.length > 0) {
        achieved = true;
        const totalAmt = relevantOpps.reduce((sum, opp) => {
          const amt = Number.parseFloat(String(opp.amount || "0.00"));
          return sum + (Number.isNaN(amt) ? 0 : amt);
        }, 0);
        revenue = totalAmt.toFixed(2);
      }
    }

    if (achieved) {
      // Update status to converted
      await dbStore.marketingSequenceMemberships.update(membership.id, {
        status: "converted",
      });

      // Insert conversion log
      await dbStore.marketingSequenceConversions.insert({
        orgId,
        membershipId: membership.id,
        sequenceId: membership.sequenceId,
        goalId: goal.id,
        attributedRevenue: revenue,
        convertedAt: new Date(),
      });

      // Insert audit log
      await dbStore.auditLogs.insert({
        orgId,
        recordId: membership.id,
        recordType: "marketing_sequence_memberships",
        action: "goal_conversion",
        userId: "00000000-0000-0000-0000-000000000000",
        changes: {
          status: { before: membership.status, after: "converted" },
          attributedRevenue: { before: null, after: revenue },
        },
      });

      return true;
    }
  }

  return false;
}

export interface CoreActivity {
  id: string;
  orgId: string;
  creatorId: string;
  type: string;
  subject: string;
  body: string | null;
  dueDate: Date | null;
  createdAt: Date;
  custom?: Record<string, unknown> | null;
}

export interface CoreActivityLink {
  id: string;
  orgId: string;
  activityId: string;
  targetType: string;
  targetId: string;
}

export interface CoreEmailTracker {
  id: string;
  activityId: string;
  openCount: number;
  clickCount: number;
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
      update: (
        id: string,
        updates: Partial<
          Omit<CoreSequenceStep, "id" | "orgId" | "createdAt" | "updatedAt">
        >,
      ) => Promise<CoreSequenceStep | null>;
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
        createdAt?: Date;
        custom?: Record<string, unknown> | null;
      }) => Promise<{ id: string }>;
      findMany?: () => Promise<CoreActivity[]>;
    };
    activityLinks: {
      insert: (item: {
        orgId: string;
        activityId: string;
        targetType: "Lead" | "Account" | "Contact" | "Opportunity" | "Campaign";
        targetId: string;
      }) => Promise<unknown>;
      findMany?: () => Promise<CoreActivityLink[]>;
    };
    emailTrackers?: {
      findMany: () => Promise<CoreEmailTracker[]>;
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
      update?: (
        id: string,
        updates: Partial<
          Omit<CoreStepSplitTest, "id" | "orgId" | "createdAt" | "updatedAt">
        >,
      ) => Promise<CoreStepSplitTest | null>;
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
      findMany?: () => Promise<CoreAbAllocation[]>;
    };
    marketingSequenceStepBranches?: {
      findForStep: (stepId: string) => Promise<CoreStepBranch | null>;
    };
    marketingSequenceGoals?: {
      findForSequence: (sequenceId: string) => Promise<CoreSequenceGoal[]>;
    };
    marketingSequenceConversions?: {
      insert: (item: {
        orgId: string;
        membershipId: string;
        sequenceId: string;
        goalId: string;
        attributedRevenue: string;
        convertedAt: Date;
      }) => Promise<CoreSequenceConversion>;
    };
    marketingSequenceSuppressions?: {
      findForOrg: (orgId: string) => Promise<CoreSequenceSuppression[]>;
    };
    marketingSequenceExclusions?: {
      findForSequence: (sequenceId: string) => Promise<CoreSequenceExclusion[]>;
    };
    marketingSegmentMemberships?: {
      findForRecord: (
        recordType: string,
        recordId: string,
      ) => Promise<{ segmentId: string }[]>;
    };
    marketingSequences?: {
      findOne: (id: string) => Promise<CoreSequence | null>;
    };
  },
  currentTime: Date = new Date(),
): Promise<number> {
  const memberships = await dbStore.marketingSequenceMemberships.findMany();

  const sequenceSendsToday = new Map<string, number>();

  function isSameDay(d1: Date, d2: Date): boolean {
    return (
      d1.getFullYear() === d2.getFullYear() &&
      d1.getMonth() === d2.getMonth() &&
      d1.getDate() === d2.getDate()
    );
  }

  for (const m of memberships) {
    if (
      m.lastExecutedAt &&
      isSameDay(new Date(m.lastExecutedAt), currentTime)
    ) {
      const count = sequenceSendsToday.get(m.sequenceId) || 0;
      sequenceSendsToday.set(m.sequenceId, count + 1);
    }
  }

  // Auto-resume memberships whose snooze period has expired
  for (const m of memberships) {
    if (
      m.status === "snoozed" &&
      m.snoozeUntil &&
      new Date(m.snoozeUntil) <= currentTime
    ) {
      const originalSnoozeUntil = m.snoozeUntil;
      await dbStore.marketingSequenceMemberships.update(m.id, {
        status: "active",
        snoozeUntil: null,
        snoozeReason: null,
        nextExecutionAt: currentTime,
      });

      // Update local object so it can be executed immediately in this cycle if eligible
      m.status = "active";
      m.snoozeUntil = null;
      m.snoozeReason = null;
      m.nextExecutionAt = currentTime;

      await dbStore.auditLogs.insert({
        orgId: m.orgId,
        recordId: m.id,
        recordType: "marketing_sequence_memberships",
        action: "membership_resumed",
        userId: "00000000-0000-0000-0000-000000000000",
        changes: {
          status: { before: "snoozed", after: "active" },
          snoozeUntil: {
            before: originalSnoozeUntil
              ? new Date(originalSnoozeUntil).toISOString()
              : null,
            after: null,
          },
        },
      });
    }
  }

  const pendingMemberships = memberships.filter(
    (m) => m.status === "active" && new Date(m.nextExecutionAt) <= currentTime,
  );

  let processedCount = 0;

  for (const membership of pendingMemberships) {
    const orgId = membership.orgId;

    let recipientTimezone: string | null = null;
    if (membership.recordType === "lead" && dbStore.leads) {
      // biome-ignore lint/suspicious/noExplicitAny: dbStore findOne returns unknown, casting to any is safe here
      const lead: any = await dbStore.leads.findOne(membership.recordId);
      if (lead?.custom?.timezone) {
        recipientTimezone = lead.custom.timezone;
      }
    } else if (membership.recordType === "contact" && dbStore.contacts) {
      // biome-ignore lint/suspicious/noExplicitAny: dbStore findOne returns unknown, casting to any is safe here
      const contact: any = await dbStore.contacts.findOne(membership.recordId);
      if (contact?.custom?.timezone) {
        recipientTimezone = contact.custom.timezone;
      }
    }

    let sequence: CoreSequence | null = null;
    if (dbStore.marketingSequences) {
      sequence = await dbStore.marketingSequences.findOne(
        membership.sequenceId,
      );
    }

    if (sequence) {
      if (sequence.status === "paused") {
        continue;
      }
      const validTime = getNextValidSendingTime(
        currentTime,
        sequence.sendingDays || null,
        sequence.sendingWindowStart || null,
        sequence.sendingWindowEnd || null,
        recipientTimezone,
      );
      if (validTime.getTime() > currentTime.getTime()) {
        const originalNext = membership.nextExecutionAt;
        await dbStore.marketingSequenceMemberships.update(membership.id, {
          nextExecutionAt: validTime,
        });
        await dbStore.auditLogs.insert({
          orgId: membership.orgId,
          recordId: membership.id,
          recordType: "marketing_sequence_memberships",
          action: "membership_schedule_deferred",
          userId: "00000000-0000-0000-0000-000000000000",
          changes: {
            nextExecutionAt: {
              before:
                originalNext instanceof Date
                  ? originalNext.toISOString()
                  : new Date(originalNext).toISOString(),
              after: validTime.toISOString(),
            },
          },
        });
        continue;
      }

      const dailyLimit = sequence.dailySendLimit;
      if (dailyLimit !== undefined && dailyLimit !== null && dailyLimit > 0) {
        const sentCount = sequenceSendsToday.get(membership.sequenceId) || 0;
        if (sentCount >= dailyLimit) {
          const validDeferredTime = new Date(
            currentTime.getTime() + 24 * 60 * 60 * 1000,
          );
          const originalNext = membership.nextExecutionAt;
          await dbStore.marketingSequenceMemberships.update(membership.id, {
            nextExecutionAt: validDeferredTime,
          });
          await dbStore.auditLogs.insert({
            orgId: membership.orgId,
            recordId: membership.id,
            recordType: "marketing_sequence_memberships",
            action: "membership_schedule_deferred",
            userId: "00000000-0000-0000-0000-000000000000",
            changes: {
              nextExecutionAt: {
                before:
                  originalNext instanceof Date
                    ? originalNext.toISOString()
                    : new Date(originalNext).toISOString(),
                after: validDeferredTime.toISOString(),
              },
              throttle_reason: {
                before: null,
                after: `Daily sending throttle reached: limit is ${dailyLimit}`,
              },
            },
          });
          continue;
        }
      }
    }

    let recipientEmail: string | null = null;
    if (membership.recordType === "lead" && dbStore.leads) {
      // biome-ignore lint/suspicious/noExplicitAny: casting is safe
      const lead: any = await dbStore.leads.findOne(membership.recordId);
      if (lead?.email) {
        recipientEmail = lead.email;
      }
    } else if (membership.recordType === "contact" && dbStore.contacts) {
      // biome-ignore lint/suspicious/noExplicitAny: casting is safe
      const contact: any = await dbStore.contacts.findOne(membership.recordId);
      if (contact?.email) {
        recipientEmail = contact.email;
      }
    }

    if (recipientEmail) {
      const domain = recipientEmail.split("@")[1]?.toLowerCase() || "";
      let domainLimit = 5;
      let recipientCap = 3;
      // biome-ignore lint/suspicious/noExplicitAny: casting is safe
      if ((dbStore as any).marketingSequenceCaps) {
        const capsList =
          await // biome-ignore lint/suspicious/noExplicitAny: casting is safe
          (dbStore as any).marketingSequenceCaps.findMany();
        if (capsList && capsList.length > 0) {
          domainLimit = capsList[0].domainThrottleLimit;
          recipientCap = capsList[0].recipientFrequencyCap;
        }
      }

      const activities = dbStore.activities.findMany
        ? await dbStore.activities.findMany()
        : [];
      const links = dbStore.activityLinks.findMany
        ? await dbStore.activityLinks.findMany()
        : [];

      const oneDayAgo = new Date(currentTime.getTime() - 24 * 60 * 60 * 1000);
      const sevenDaysAgo = new Date(
        currentTime.getTime() - 7 * 24 * 60 * 60 * 1000,
      );

      let domainSentCount = 0;
      let recipientSentCount = 0;

      for (const act of activities) {
        if (act.orgId !== orgId || act.type !== "email") continue;
        const actTime = new Date(act.createdAt);

        if (actTime >= sevenDaysAgo && actTime <= currentTime) {
          const hasLink = links.some(
            (l) =>
              l.activityId === act.id &&
              l.targetId === membership.recordId &&
              l.targetType.toLowerCase() ===
                membership.recordType.toLowerCase(),
          );
          if (hasLink) {
            recipientSentCount++;
          }
        }

        if (actTime >= oneDayAgo && actTime <= currentTime) {
          const actLinksForActivity = links.filter(
            (l) => l.activityId === act.id,
          );
          for (const link of actLinksForActivity) {
            let linkedEmail: string | null = null;
            if (link.targetType === "Lead" && dbStore.leads) {
              // biome-ignore lint/suspicious/noExplicitAny: casting is safe
              const lead: any = await dbStore.leads.findOne(link.targetId);
              if (lead?.email) {
                linkedEmail = lead.email;
              }
            } else if (link.targetType === "Contact" && dbStore.contacts) {
              // biome-ignore lint/suspicious/noExplicitAny: casting is safe
              const contact: any = await dbStore.contacts.findOne(
                link.targetId,
              );
              if (contact?.email) {
                linkedEmail = contact.email;
              }
            }
            if (linkedEmail) {
              const linkedDomain =
                linkedEmail.split("@")[1]?.toLowerCase() || "";
              if (linkedDomain === domain) {
                domainSentCount++;
                break;
              }
            }
          }
        }
      }

      if (domainSentCount >= domainLimit) {
        const nextExec = new Date(currentTime.getTime() + 24 * 60 * 60 * 1000);
        await dbStore.marketingSequenceMemberships.update(membership.id, {
          nextExecutionAt: nextExec,
        });
        await dbStore.auditLogs.insert({
          orgId,
          recordId: membership.id,
          recordType: "marketing_sequence_memberships",
          action: "deferred_domain_throttle",
          userId: "00000000-0000-0000-0000-000000000000",
          changes: {
            domain: { before: null, after: domain },
            sentCount: { before: null, after: domainSentCount },
            limit: { before: null, after: domainLimit },
            nextExecutionAt: {
              before: new Date(membership.nextExecutionAt).toISOString(),
              after: nextExec.toISOString(),
            },
          },
        });
        continue;
      }

      if (recipientSentCount >= recipientCap) {
        const nextExec = new Date(currentTime.getTime() + 24 * 60 * 60 * 1000);
        await dbStore.marketingSequenceMemberships.update(membership.id, {
          nextExecutionAt: nextExec,
        });
        await dbStore.auditLogs.insert({
          orgId,
          recordId: membership.id,
          recordType: "marketing_sequence_memberships",
          action: "deferred_frequency_cap",
          userId: "00000000-0000-0000-0000-000000000000",
          changes: {
            recipient: { before: null, after: recipientEmail },
            sentCount: { before: null, after: recipientSentCount },
            limit: { before: null, after: recipientCap },
            nextExecutionAt: {
              before: new Date(membership.nextExecutionAt).toISOString(),
              after: nextExec.toISOString(),
            },
          },
        });
        continue;
      }
    }

    const steps = await dbStore.marketingSequenceSteps.findForSequence(
      membership.sequenceId,
    );

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

    if (
      dbStore.marketingSequenceSuppressions &&
      dbStore.marketingSequenceExclusions
    ) {
      const recordEmail =
        membership.recordType === "lead"
          ? (recipientContext.lead?.email as string | undefined)
          : (recipientContext.contact?.email as string | undefined);
      const suppressionStatus = await isRecordSuppressedOrExcluded({
        orgId,
        sequenceId: membership.sequenceId,
        recordType: membership.recordType,
        recordId: membership.recordId,
        email: recordEmail,
        // biome-ignore lint/suspicious/noExplicitAny: dbStore type alignment
        dbStore: dbStore as any,
      });

      if (suppressionStatus.suppressed) {
        await dbStore.marketingSequenceMemberships.update(membership.id, {
          status: "suppressed",
        });

        await dbStore.auditLogs.insert({
          orgId,
          recordId: membership.id,
          recordType: "marketing_sequence_memberships",
          action: "membership_suppressed",
          userId: "00000000-0000-0000-0000-000000000000",
          changes: {
            status: { before: "active", after: "suppressed" },
          },
        });

        processedCount++;
        continue;
      }
    }

    if (
      dbStore.marketingSequenceGoals &&
      dbStore.marketingSequenceConversions
    ) {
      const goalConverted = await evaluateSequenceGoals(
        dbStore,
        orgId,
        membership,
        recipientContext,
      );
      if (goalConverted) {
        processedCount++;
        continue;
      }
    }

    let nextStepNumber = membership.currentStepNumber + 1;

    // Check if the current step has a branching rule to evaluate
    if (
      membership.currentStepNumber > 0 &&
      dbStore.marketingSequenceStepBranches
    ) {
      const currentStepObj = steps.find(
        (s) => s.stepNumber === membership.currentStepNumber,
      );
      if (currentStepObj) {
        const branchRule =
          await dbStore.marketingSequenceStepBranches.findForStep(
            currentStepObj.id,
          );
        if (branchRule) {
          // Evaluate branching condition
          // biome-ignore lint/suspicious/noExplicitAny: dbStore dynamic
          const allLinks = await (dbStore as any).activityLinks.findMany();
          // biome-ignore lint/suspicious/noExplicitAny: dbStore dynamic
          const allActivities = await (dbStore as any).activities.findMany();
          // biome-ignore lint/suspicious/noExplicitAny: dbStore dynamic
          const allTrackers = await (dbStore as any).emailTrackers.findMany();

          const recordLinks = allLinks.filter(
            // biome-ignore lint/suspicious/noExplicitAny: link dynamic
            (link: any) =>
              link.targetId === membership.recordId &&
              (link.targetType === "Lead" || link.targetType === "Contact"),
          );
          // biome-ignore lint/suspicious/noExplicitAny: link dynamic
          const recordActivityIds = recordLinks.map((l: any) => l.activityId);
          const emailActs = allActivities.filter(
            // biome-ignore lint/suspicious/noExplicitAny: act dynamic
            (act: any) =>
              act.type === "email" && recordActivityIds.includes(act.id),
          );
          // biome-ignore lint/suspicious/noExplicitAny: act dynamic
          emailActs.sort((a: any, b: any) => a.id.localeCompare(b.id));

          const stepActivity = emailActs[membership.currentStepNumber - 1];
          let conditionMet = false;
          if (stepActivity) {
            const tracker = allTrackers.find(
              // biome-ignore lint/suspicious/noExplicitAny: tracker dynamic
              (t: any) => t.activityId === stepActivity.id,
            );
            if (tracker) {
              if (branchRule.branchType === "email_open") {
                conditionMet = tracker.openCount > 0;
              } else if (branchRule.branchType === "email_click") {
                conditionMet = tracker.clickCount > 0;
              }
            }
          }

          nextStepNumber = conditionMet
            ? branchRule.trueNextStepNumber
            : branchRule.falseNextStepNumber;
        }
      }
    }

    const step = steps.find((s) => s.stepNumber === nextStepNumber);

    if (!step) {
      await dbStore.marketingSequenceMemberships.update(membership.id, {
        status: "completed",
        currentStepNumber: membership.currentStepNumber,
      });
      processedCount++;
      continue;
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
      let splitTest = await dbStore.marketingSequenceStepSplitTests.findForStep(
        step.id,
      );
      if (splitTest && splitTest.isActive === 1) {
        if (
          splitTest.autoPromoteWinner === 1 &&
          dbStore.marketingSequenceMemberships &&
          dbStore.activities.findMany &&
          dbStore.activityLinks.findMany &&
          dbStore.emailTrackers?.findMany &&
          dbStore.marketingSequenceAbAllocations.findMany &&
          dbStore.marketingSequenceStepSplitTests.update
        ) {
          const seqMemberships =
            await dbStore.marketingSequenceMemberships.findMany();
          const relevantMembers = seqMemberships.filter(
            (m) => m.sequenceId === membership.sequenceId && m.orgId === orgId,
          );

          const stepAllocations =
            await dbStore.marketingSequenceAbAllocations.findMany();
          const relevantAllocs = stepAllocations.filter(
            (a) => a.stepId === step.id && a.orgId === orgId,
          );

          const activityLinks = await dbStore.activityLinks.findMany();
          const activities = await dbStore.activities.findMany();
          const emailTrackers = await dbStore.emailTrackers.findMany();

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

          let baseSends = 0;
          let baseOpens = 0;
          let baseClicks = 0;
          let variantSends = 0;
          let variantOpens = 0;
          let variantClicks = 0;

          for (const m of relevantMembers) {
            const alloc = relevantAllocs.find((a) => a.membershipId === m.id);
            if (!alloc) continue;

            const linksForRecord = activityLinks.filter(
              (link) =>
                link.targetId === m.recordId &&
                link.orgId === orgId &&
                (link.targetType === "Lead" || link.targetType === "Contact"),
            );
            const activityIds = linksForRecord.map((l) => l.activityId);
            const emailActs = activities.filter(
              (act) =>
                act.type === "email" &&
                act.orgId === orgId &&
                activityIds.includes(act.id),
            );
            emailActs.sort((a, b) => a.id.localeCompare(b.id));

            const actForStep = emailActs[step.stepNumber - 1];
            if (actForStep) {
              const tracker = trackerByActivity.get(actForStep.id);
              const isOpened = tracker ? tracker.openCount > 0 : false;
              const isClicked = tracker ? tracker.clickCount > 0 : false;

              if (alloc.allocatedTemplateId === step.templateId) {
                baseSends++;
                if (isOpened) baseOpens++;
                if (isClicked) baseClicks++;
              } else if (
                alloc.allocatedTemplateId === splitTest.variantTemplateId
              ) {
                variantSends++;
                if (isOpened) variantOpens++;
                if (isClicked) variantClicks++;
              }
            }
          }

          const totalSends = baseSends + variantSends;
          const minSends = splitTest.minSendsToEvaluate ?? 10;
          if (totalSends >= minSends) {
            let baseRate = 0;
            let variantRate = 0;
            const metric = splitTest.evaluationMetric || "open_rate";

            if (metric === "open_rate") {
              baseRate = baseSends > 0 ? baseOpens / baseSends : 0;
              variantRate = variantSends > 0 ? variantOpens / variantSends : 0;
            } else if (metric === "click_rate") {
              baseRate = baseSends > 0 ? baseClicks / baseSends : 0;
              variantRate = variantSends > 0 ? variantClicks / variantSends : 0;
            }

            let winnerTemplateId = step.templateId;
            let winnerLabel = "base";

            if (variantRate > baseRate) {
              winnerTemplateId = splitTest.variantTemplateId;
              winnerLabel = "variant";
            }

            await dbStore.marketingSequenceSteps.update(step.id, {
              templateId: winnerTemplateId,
            });

            await dbStore.marketingSequenceStepSplitTests.update(splitTest.id, {
              isActive: 0,
            });

            if (dbStore.auditLogs) {
              await dbStore.auditLogs.insert({
                orgId,
                recordId: splitTest.id,
                recordType: "marketing_sequence_step_split_tests",
                action: "auto_promoted",
                userId: "00000000-0000-0000-0000-000000000000",
                changes: {
                  winnerTemplateId: {
                    before: step.templateId,
                    after: winnerTemplateId,
                  },
                  winnerLabel: { before: "none", after: winnerLabel },
                  evaluationMetric: { before: null, after: metric },
                  totalSends: { before: 0, after: totalSends },
                  baseSends: { before: 0, after: baseSends },
                  baseRate: { before: 0, after: baseRate },
                  variantSends: { before: 0, after: variantSends },
                  variantRate: { before: 0, after: variantRate },
                },
              });
            }

            splitTest =
              await dbStore.marketingSequenceStepSplitTests.findForStep(
                step.id,
              );
            step.templateId = winnerTemplateId;
            templateIdToUse = winnerTemplateId;
          }
        }

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

    let resolvedSenderId = "00000000-0000-0000-0000-000000000000";
    if (sequence) {
      const senderType = sequence.senderType || "system";
      if (senderType === "owner") {
        let recipient: { ownerId?: string } | null = null;
        if (membership.recordType === "lead" && dbStore.leads) {
          recipient = (await dbStore.leads.findOne(membership.recordId)) as {
            ownerId?: string;
          } | null;
        } else if (membership.recordType === "contact" && dbStore.contacts) {
          recipient = (await dbStore.contacts.findOne(membership.recordId)) as {
            ownerId?: string;
          } | null;
        }
        if (recipient?.ownerId) {
          resolvedSenderId = recipient.ownerId;
        }
      } else if (senderType === "specific" && sequence.senderUserId) {
        resolvedSenderId = sequence.senderUserId;
      }
    }

    let finalSubject = compiled.subject;
    const customAttributes: Record<string, unknown> = {};

    if (step.replyToStepNumber && step.replyToStepNumber >= 1) {
      const targetStep = steps.find(
        (s) =>
          s.sequenceId === step.sequenceId &&
          s.stepNumber === step.replyToStepNumber &&
          s.orgId === orgId,
      );

      if (targetStep) {
        const activities = (await dbStore.activities.findMany?.()) || [];
        const links = (await dbStore.activityLinks.findMany?.()) || [];

        const targetLinks = links.filter(
          (l) =>
            l.orgId === orgId &&
            l.targetType ===
              (membership.recordType === "lead" ? "Lead" : "Contact") &&
            l.targetId === membership.recordId,
        );

        const targetActivityIds = new Set(targetLinks.map((l) => l.activityId));
        const parentActivity = activities.find(
          (a) =>
            targetActivityIds.has(a.id) &&
            a.orgId === orgId &&
            a.type === "email" &&
            a.subject,
        );

        if (parentActivity) {
          const startsWithRe = /^re:/i.test(parentActivity.subject);
          finalSubject = startsWithRe
            ? parentActivity.subject
            : `Re: ${parentActivity.subject}`;

          customAttributes.parent_activity_id = parentActivity.id;
        }
      }
    }

    const activity = await dbStore.activities.insert({
      orgId,
      creatorId: resolvedSenderId,
      type: "email",
      subject: finalSubject,
      body: compiled.body,
      dueDate: null,
      createdAt: currentTime,
      custom:
        Object.keys(customAttributes).length > 0 ? customAttributes : null,
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

    let nextStatus = "active";
    let nextExecTime = new Date();

    const stepJustExecuted = steps.find((s) => s.stepNumber === nextStepNumber);
    const branchForExecutedStep =
      stepJustExecuted && dbStore.marketingSequenceStepBranches
        ? await dbStore.marketingSequenceStepBranches.findForStep(
            stepJustExecuted.id,
          )
        : null;

    if (branchForExecutedStep) {
      nextExecTime = new Date(
        currentTime.getTime() +
          branchForExecutedStep.evaluationWindowDays * 24 * 60 * 60 * 1000,
      );
    } else {
      const nextStep = steps.find((s) => s.stepNumber === nextStepNumber + 1);
      if (!nextStep) {
        nextStatus = "completed";
      } else {
        nextExecTime = calculateNextStepExecutionTime(
          currentTime,
          nextStep.delayDays,
          nextStep.waitCondition || undefined,
        );
      }
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

    const count = sequenceSendsToday.get(membership.sequenceId) || 0;
    sequenceSendsToday.set(membership.sequenceId, count + 1);

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

export async function handleEmailDeliveryEvent(
  dbStore: {
    marketingSequenceMemberships: {
      // biome-ignore lint/suspicious/noExplicitAny: memberships findMany structure
      findMany: () => Promise<any[]>;
      update: (
        id: string,
        updates: Partial<
          Omit<
            CoreSequenceMembership,
            "id" | "orgId" | "createdAt" | "updatedAt"
          >
        >,
      ) => Promise<unknown>;
    };
    marketingSequenceSuppressions: {
      insert: (item: {
        orgId: string;
        recordType: string;
        recordId: string | null;
        pattern: string;
        reason: string;
      }) => Promise<unknown>;
    };
    leads: {
      // biome-ignore lint/suspicious/noExplicitAny: leads findMany structure
      findMany: () => Promise<any[]>;
      // biome-ignore lint/suspicious/noExplicitAny: leads update structure
      update: (id: string, updates: any) => Promise<any>;
    };
    contacts: {
      // biome-ignore lint/suspicious/noExplicitAny: contacts findMany structure
      findMany: () => Promise<any[]>;
      // biome-ignore lint/suspicious/noExplicitAny: contacts update structure
      update: (id: string, updates: any) => Promise<any>;
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
    emailBounceEvents?: {
      insert: (item: {
        orgId: string;
        trackerId: string;
        eventType: string;
        bounceType: string;
        bounceReason: string | null;
      }) => Promise<unknown>;
    };
    emailTrackers?: {
      // biome-ignore lint/suspicious/noExplicitAny: trackers findMany structure
      findMany: () => Promise<any[]>;
      // biome-ignore lint/suspicious/noExplicitAny: trackers findOne structure
      findOne: (id: string) => Promise<any>;
      // biome-ignore lint/suspicious/noExplicitAny: trackers updatePublic structure
      updatePublic: (id: string, updates: any) => Promise<any>;
    };
    activityLinks?: {
      // biome-ignore lint/suspicious/noExplicitAny: activityLinks findMany structure
      findMany: () => Promise<any[]>;
    };
  },
  eventDetails: {
    orgId: string;
    email: string;
    event: "bounce" | "complaint";
    reason?: string;
    bounceType?: string;
    trackerId?: string;
  },
): Promise<{ suppressionsCreated: number; membershipsExited: number }> {
  const { orgId, email, event, reason } = eventDetails;

  // 1. Find matching leads and contacts
  const leads = await dbStore.leads.findMany();
  const matchedLeads = leads.filter(
    (l) =>
      l.orgId === orgId &&
      l.email &&
      l.email.toLowerCase() === email.toLowerCase(),
  );

  const contacts = await dbStore.contacts.findMany();
  const matchedContacts = contacts.filter(
    (c) =>
      c.orgId === orgId &&
      c.email &&
      c.email.toLowerCase() === email.toLowerCase(),
  );

  let suppressionsCreated = 0;

  // Insert suppression record for every matched lead
  for (const lead of matchedLeads) {
    await dbStore.marketingSequenceSuppressions.insert({
      orgId,
      recordType: "lead",
      recordId: lead.id,
      pattern: email.toLowerCase(),
      reason: event,
    });
    suppressionsCreated++;

    // Update Lead custom field
    const currentCustom = lead.custom || {};
    await dbStore.leads.update(lead.id, {
      custom: {
        ...currentCustom,
        email_status: event === "bounce" ? "bounced" : "complained",
        email_status_reason: reason || null,
      },
    });
  }

  // Insert suppression record for every matched contact
  for (const contact of matchedContacts) {
    await dbStore.marketingSequenceSuppressions.insert({
      orgId,
      recordType: "contact",
      recordId: contact.id,
      pattern: email.toLowerCase(),
      reason: event,
    });
    suppressionsCreated++;

    // Update Contact custom field
    const currentCustom = contact.custom || {};
    await dbStore.contacts.update(contact.id, {
      custom: {
        ...currentCustom,
        email_status: event === "bounce" ? "bounced" : "complained",
        email_status_reason: reason || null,
      },
    });
  }

  // If no lead or contact matched, still create a general suppression record
  if (matchedLeads.length === 0 && matchedContacts.length === 0) {
    await dbStore.marketingSequenceSuppressions.insert({
      orgId,
      recordType: "email_domain",
      recordId: null,
      pattern: email.toLowerCase(),
      reason: event,
    });
    suppressionsCreated++;
  }

  // Record granular bounce/complaint event
  // biome-ignore lint/suspicious/noExplicitAny: tracker log variable
  let trackerToLog: any = null;
  if (eventDetails.trackerId && dbStore.emailTrackers) {
    trackerToLog = await dbStore.emailTrackers.findOne(eventDetails.trackerId);
  } else if (dbStore.emailTrackers && dbStore.activityLinks) {
    const allTrackers = await dbStore.emailTrackers.findMany();
    const allLinks = await dbStore.activityLinks.findMany();
    // Sort trackers descending by date
    allTrackers.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

    const matchedIds = [
      ...matchedLeads.map((l) => l.id),
      ...matchedContacts.map((c) => c.id),
    ];
    for (const tracker of allTrackers) {
      if (tracker.orgId === orgId) {
        const link = allLinks.find(
          (l) =>
            l.activityId === tracker.activityId &&
            l.orgId === orgId &&
            matchedIds.includes(l.targetId),
        );
        if (link) {
          trackerToLog = tracker;
          break;
        }
      }
    }
  }

  if (trackerToLog && dbStore.emailBounceEvents) {
    const bounceType =
      eventDetails.bounceType ||
      (event === "complaint"
        ? "spam_complaint"
        : reason?.toLowerCase().includes("soft")
          ? "soft"
          : "hard");
    await dbStore.emailBounceEvents.insert({
      orgId,
      trackerId: trackerToLog.id,
      eventType: event,
      bounceType,
      bounceReason: reason || null,
    });

    if (dbStore.emailTrackers?.updatePublic) {
      await dbStore.emailTrackers.updatePublic(trackerToLog.id, {
        bounceCount: (trackerToLog.bounceCount || 0) + 1,
        lastBouncedAt: new Date(),
      });
    }
  }

  // 2. Find and update active/snoozed sequence memberships
  const memberships = await dbStore.marketingSequenceMemberships.findMany();
  const matchedRecordIds = new Set([
    ...matchedLeads.map((l) => l.id),
    ...matchedContacts.map((c) => c.id),
  ]);

  const membershipsToExit = memberships.filter(
    (m) =>
      m.orgId === orgId &&
      matchedRecordIds.has(m.recordId) &&
      (m.status === "active" || m.status === "snoozed"),
  );

  let membershipsExited = 0;
  for (const m of membershipsToExit) {
    const originalStatus = m.status;
    await dbStore.marketingSequenceMemberships.update(m.id, {
      status: "exited",
      nextExecutionAt: null as unknown as Date,
      snoozeUntil: null,
      snoozeReason: null,
    });

    membershipsExited++;

    // Write audit log
    await dbStore.auditLogs.insert({
      orgId,
      recordId: m.id,
      recordType: "marketing_sequence_memberships",
      action:
        event === "bounce"
          ? "membership_exit_bounce"
          : "membership_exit_complaint",
      userId: "00000000-0000-0000-0000-000000000000",
      changes: {
        status: { before: originalStatus, after: "exited" },
        nextExecutionAt: {
          before: m.nextExecutionAt
            ? m.nextExecutionAt instanceof Date
              ? m.nextExecutionAt.toISOString()
              : String(m.nextExecutionAt)
            : null,
          after: null,
        },
      },
    });
  }

  return { suppressionsCreated, membershipsExited };
}

export async function processSequenceLinkClick(
  // biome-ignore lint/suspicious/noExplicitAny: dynamic store
  dbStore: any,
  orgId: string,
  activityId: string,
  clickedUrl: string,
  currentTime: Date = new Date(),
): Promise<number> {
  const links = (await dbStore.activityLinks.findMany()) as {
    activityId: string;
    orgId: string;
    targetType: "Lead" | "Contact" | "Opportunity" | "Account" | "Campaign";
    targetId: string;
  }[];
  const actLink = links.find(
    (l) =>
      l.activityId === activityId &&
      l.orgId === orgId &&
      (l.targetType.toLowerCase() === "lead" ||
        l.targetType.toLowerCase() === "contact"),
  );
  if (!actLink) return 0;

  const memberships =
    (await dbStore.marketingSequenceMemberships.findMany()) as {
      id: string;
      recordId: string;
      recordType: string;
      orgId: string;
      status: string;
      sequenceId: string;
    }[];
  const recordTypeLower = actLink.targetType.toLowerCase();
  const membership = memberships.find(
    (m) =>
      m.recordId === actLink.targetId &&
      m.recordType === recordTypeLower &&
      m.orgId === orgId &&
      (m.status === "active" || m.status === "completed"),
  );
  if (!membership) return 0;

  // Fetch all activities for this recipient, filter by email type, and sort by ID
  const allActs = (await dbStore.activities.findMany()) as {
    id: string;
    type: string;
    orgId: string;
  }[];
  const recipientActivityIds = new Set(
    links
      .filter(
        (l) =>
          l.targetId === actLink.targetId &&
          l.targetType.toLowerCase() === recordTypeLower &&
          l.orgId === orgId,
      )
      .map((l) => l.activityId),
  );

  const emailActs = allActs.filter(
    (act) =>
      act.type === "email" &&
      act.orgId === orgId &&
      recipientActivityIds.has(act.id),
  );
  emailActs.sort((a, b) => a.id.localeCompare(b.id));

  // Determine which step this is
  const clickedIdx = emailActs.findIndex((act) => act.id === activityId);
  if (clickedIdx === -1) return 0;
  const stepNumber = clickedIdx + 1;

  const steps = (await dbStore.marketingSequenceSteps.findForSequence(
    membership.sequenceId,
  )) as { id: string; stepNumber: number; orgId: string }[];
  const step = steps.find(
    (s) => s.stepNumber === stepNumber && s.orgId === orgId,
  );
  if (!step) return 0;

  const actions = (await dbStore.marketingSequenceLinkActions.findForStep(
    step.id,
  )) as {
    orgId: string;
    targetUrl: string;
    actionType: string;
    actionConfig: {
      field?: string;
      value?: string;
      subject?: string;
      body?: string | null;
      dueDateOffsetDays?: number;
    };
  }[];
  const matchingActions = actions.filter(
    (act) =>
      act.orgId === orgId &&
      (act.targetUrl === clickedUrl || act.targetUrl === "*"),
  );

  let executedCount = 0;
  for (const act of matchingActions) {
    if (act.actionType === "field_update") {
      const field = act.actionConfig?.field;
      const value = act.actionConfig?.value;
      if (field && value !== undefined) {
        if (recordTypeLower === "lead" && dbStore.leads) {
          const lead = await dbStore.leads.findOne(actLink.targetId);
          if (lead) {
            // biome-ignore lint/suspicious/noExplicitAny: casting safe
            const leadAny = lead as any;
            const beforeVal = field.startsWith("custom.")
              ? (leadAny.custom as Record<string, unknown>)?.[
                  field.substring(7)
                ]
              : leadAny[field];

            if (field.startsWith("custom.")) {
              const customField = field.substring(7);
              const newCustom = {
                ...(leadAny.custom || {}),
                [customField]: value,
              };
              await dbStore.leads.update(actLink.targetId, {
                custom: newCustom,
              });
            } else {
              await dbStore.leads.update(actLink.targetId, { [field]: value });
            }

            await dbStore.auditLogs.insert({
              orgId,
              recordId: actLink.targetId,
              recordType: "lead",
              action: "link_trigger_field_update",
              userId: "00000000-0000-0000-0000-000000000000",
              changes: {
                [field]: { before: beforeVal, after: value },
              },
            });
            executedCount++;
          }
        } else if (recordTypeLower === "contact" && dbStore.contacts) {
          const contact = await dbStore.contacts.findOne(actLink.targetId);
          if (contact) {
            // biome-ignore lint/suspicious/noExplicitAny: casting safe
            const contactAny = contact as any;
            const beforeVal = field.startsWith("custom.")
              ? (contactAny.custom as Record<string, unknown>)?.[
                  field.substring(7)
                ]
              : contactAny[field];

            if (field.startsWith("custom.")) {
              const customField = field.substring(7);
              const newCustom = {
                ...(contactAny.custom || {}),
                [customField]: value,
              };
              await dbStore.contacts.update(actLink.targetId, {
                custom: newCustom,
              });
            } else {
              await dbStore.contacts.update(actLink.targetId, {
                [field]: value,
              });
            }

            await dbStore.auditLogs.insert({
              orgId,
              recordId: actLink.targetId,
              recordType: "contact",
              action: "link_trigger_field_update",
              userId: "00000000-0000-0000-0000-000000000000",
              changes: {
                [field]: { before: beforeVal, after: value },
              },
            });
            executedCount++;
          }
        }
      }
    } else if (act.actionType === "create_task") {
      const subject = act.actionConfig?.subject || "Follow up";
      const body = act.actionConfig?.body || null;
      const offsetDays = act.actionConfig?.dueDateOffsetDays || 0;
      const dueDate = new Date(
        currentTime.getTime() + offsetDays * 24 * 60 * 60 * 1000,
      );

      const task = await dbStore.activities.insert({
        orgId,
        creatorId: "00000000-0000-0000-0000-000000000000",
        type: "task",
        subject,
        body,
        dueDate,
        createdAt: currentTime,
      });

      await dbStore.activityLinks.insert({
        orgId,
        activityId: task.id,
        targetType: actLink.targetType,
        targetId: actLink.targetId,
      });

      await dbStore.auditLogs.insert({
        orgId,
        recordId: membership.id,
        recordType: "marketing_sequence_memberships",
        action: "link_trigger_create_task",
        userId: "00000000-0000-0000-0000-000000000000",
        changes: {
          taskId: { before: null, after: task.id },
          subject: { before: null, after: subject },
        },
      });
      executedCount++;
    }
  }

  if (executedCount > 0) {
    await dbStore.auditLogs.insert({
      orgId,
      recordId: membership.id,
      recordType: "marketing_sequence_memberships",
      action: "link_trigger_executed",
      userId: "00000000-0000-0000-0000-000000000000",
      changes: {
        executedActionsCount: { before: 0, after: executedCount },
        clickedUrl: { before: null, after: clickedUrl },
      },
    });
  }

  return executedCount;
}

export async function processSequenceEmailOpen(
  // biome-ignore lint/suspicious/noExplicitAny: dynamic store
  dbStore: any,
  orgId: string,
  activityId: string,
  currentTime: Date = new Date(),
): Promise<number> {
  const links = (await dbStore.activityLinks.findMany()) as {
    activityId: string;
    orgId: string;
    targetType: "Lead" | "Contact" | "Opportunity" | "Account" | "Campaign";
    targetId: string;
  }[];
  const actLink = links.find(
    (l) =>
      l.activityId === activityId &&
      l.orgId === orgId &&
      (l.targetType.toLowerCase() === "lead" ||
        l.targetType.toLowerCase() === "contact"),
  );
  if (!actLink) return 0;

  const memberships =
    (await dbStore.marketingSequenceMemberships.findMany()) as {
      id: string;
      recordId: string;
      recordType: string;
      orgId: string;
      status: string;
      sequenceId: string;
    }[];
  const recordTypeLower = actLink.targetType.toLowerCase();
  const membership = memberships.find(
    (m) =>
      m.recordId === actLink.targetId &&
      m.recordType === recordTypeLower &&
      m.orgId === orgId &&
      (m.status === "active" || m.status === "completed"),
  );
  if (!membership) return 0;

  // Fetch all activities for this recipient, filter by email type, and sort by ID
  const allActs = (await dbStore.activities.findMany()) as {
    id: string;
    type: string;
    orgId: string;
  }[];
  const recipientActivityIds = new Set(
    links
      .filter(
        (l) =>
          l.targetId === actLink.targetId &&
          l.targetType.toLowerCase() === recordTypeLower &&
          l.orgId === orgId,
      )
      .map((l) => l.activityId),
  );

  const emailActs = allActs.filter(
    (act) =>
      act.type === "email" &&
      act.orgId === orgId &&
      recipientActivityIds.has(act.id),
  );
  emailActs.sort((a, b) => a.id.localeCompare(b.id));

  // Determine which step this is
  const clickedIdx = emailActs.findIndex((act) => act.id === activityId);
  if (clickedIdx === -1) return 0;
  const stepNumber = clickedIdx + 1;

  const steps = (await dbStore.marketingSequenceSteps.findForSequence(
    membership.sequenceId,
  )) as { id: string; stepNumber: number; orgId: string }[];
  const step = steps.find(
    (s) => s.stepNumber === stepNumber && s.orgId === orgId,
  );
  if (!step) return 0;

  const actions = (await dbStore.marketingSequenceOpenActions.findForStep(
    step.id,
  )) as {
    orgId: string;
    actionType: string;
    actionConfig: {
      field?: string;
      value?: string;
      subject?: string;
      body?: string | null;
      dueDateOffsetDays?: number;
    };
  }[];
  const matchingActions = actions.filter((act) => act.orgId === orgId);

  let executedCount = 0;
  for (const act of matchingActions) {
    if (act.actionType === "field_update") {
      const field = act.actionConfig?.field;
      const value = act.actionConfig?.value;
      if (field && value !== undefined) {
        if (recordTypeLower === "lead" && dbStore.leads) {
          const lead = await dbStore.leads.findOne(actLink.targetId);
          if (lead) {
            // biome-ignore lint/suspicious/noExplicitAny: casting safe
            const leadAny = lead as any;
            const beforeVal = field.startsWith("custom.")
              ? (leadAny.custom as Record<string, unknown>)?.[
                  field.substring(7)
                ]
              : leadAny[field];

            if (field.startsWith("custom.")) {
              const customField = field.substring(7);
              const newCustom = {
                ...(leadAny.custom || {}),
                [customField]: value,
              };
              await dbStore.leads.update(actLink.targetId, {
                custom: newCustom,
              });
            } else {
              await dbStore.leads.update(actLink.targetId, { [field]: value });
            }

            await dbStore.auditLogs.insert({
              orgId,
              recordId: actLink.targetId,
              recordType: "lead",
              action: "open_trigger_field_update",
              userId: "00000000-0000-0000-0000-000000000000",
              changes: {
                [field]: { before: beforeVal, after: value },
              },
            });
            executedCount++;
          }
        } else if (recordTypeLower === "contact" && dbStore.contacts) {
          const contact = await dbStore.contacts.findOne(actLink.targetId);
          if (contact) {
            // biome-ignore lint/suspicious/noExplicitAny: casting safe
            const contactAny = contact as any;
            const beforeVal = field.startsWith("custom.")
              ? (contactAny.custom as Record<string, unknown>)?.[
                  field.substring(7)
                ]
              : contactAny[field];

            if (field.startsWith("custom.")) {
              const customField = field.substring(7);
              const newCustom = {
                ...(contactAny.custom || {}),
                [customField]: value,
              };
              await dbStore.contacts.update(actLink.targetId, {
                custom: newCustom,
              });
            } else {
              await dbStore.contacts.update(actLink.targetId, {
                [field]: value,
              });
            }

            await dbStore.auditLogs.insert({
              orgId,
              recordId: actLink.targetId,
              recordType: "contact",
              action: "open_trigger_field_update",
              userId: "00000000-0000-0000-0000-000000000000",
              changes: {
                [field]: { before: beforeVal, after: value },
              },
            });
            executedCount++;
          }
        }
      }
    } else if (act.actionType === "create_task") {
      const subject = act.actionConfig?.subject || "Follow up";
      const body = act.actionConfig?.body || null;
      const offsetDays = act.actionConfig?.dueDateOffsetDays || 0;
      const dueDate = new Date(
        currentTime.getTime() + offsetDays * 24 * 60 * 60 * 1000,
      );

      const task = await dbStore.activities.insert({
        orgId,
        creatorId: "00000000-0000-0000-0000-000000000000",
        type: "task",
        subject,
        body,
        dueDate,
        createdAt: currentTime,
      });

      await dbStore.activityLinks.insert({
        orgId,
        activityId: task.id,
        targetType: actLink.targetType,
        targetId: actLink.targetId,
      });

      await dbStore.auditLogs.insert({
        orgId,
        recordId: membership.id,
        recordType: "marketing_sequence_memberships",
        action: "open_trigger_create_task",
        userId: "00000000-0000-0000-0000-000000000000",
        changes: {
          taskId: { before: null, after: task.id },
          subject: { before: null, after: subject },
        },
      });
      executedCount++;
    }
  }

  if (executedCount > 0) {
    await dbStore.auditLogs.insert({
      orgId,
      recordId: membership.id,
      recordType: "marketing_sequence_memberships",
      action: "open_trigger_executed",
      userId: "00000000-0000-0000-0000-000000000000",
      changes: {
        executedActionsCount: { before: 0, after: executedCount },
      },
    });
  }

  return executedCount;
}

export async function processSequenceEmailReply(
  // biome-ignore lint/suspicious/noExplicitAny: dynamic store
  dbStore: any,
  orgId: string,
  activityId: string,
  currentTime: Date = new Date(),
): Promise<number> {
  const links = (await dbStore.activityLinks.findMany()) as {
    activityId: string;
    orgId: string;
    targetType: "Lead" | "Contact" | "Opportunity" | "Account" | "Campaign";
    targetId: string;
  }[];
  const actLink = links.find(
    (l) =>
      l.activityId === activityId &&
      l.orgId === orgId &&
      (l.targetType.toLowerCase() === "lead" ||
        l.targetType.toLowerCase() === "contact"),
  );
  if (!actLink) return 0;

  const memberships =
    (await dbStore.marketingSequenceMemberships.findMany()) as {
      id: string;
      recordId: string;
      recordType: string;
      orgId: string;
      status: string;
      sequenceId: string;
    }[];
  const recordTypeLower = actLink.targetType.toLowerCase();
  const membership = memberships.find(
    (m) =>
      m.recordId === actLink.targetId &&
      m.recordType === recordTypeLower &&
      m.orgId === orgId &&
      (m.status === "active" || m.status === "completed"),
  );
  if (!membership) return 0;

  // Auto-complete the membership when they reply!
  const oldStatus = membership.status;
  if (oldStatus !== "completed") {
    await dbStore.marketingSequenceMemberships.update(membership.id, {
      status: "completed",
    });

    await dbStore.auditLogs.insert({
      orgId,
      recordId: membership.id,
      recordType: "marketing_sequence_memberships",
      action: "membership_auto_completed_on_reply",
      userId: "00000000-0000-0000-0000-000000000000",
      changes: {
        status: { before: oldStatus, after: "completed" },
      },
    });
  }

  // Fetch all activities for this recipient, filter by email type, and sort by ID
  const allActs = (await dbStore.activities.findMany()) as {
    id: string;
    type: string;
    orgId: string;
  }[];
  const recipientActivityIds = new Set(
    links
      .filter(
        (l) =>
          l.targetId === actLink.targetId &&
          l.targetType.toLowerCase() === recordTypeLower &&
          l.orgId === orgId,
      )
      .map((l) => l.activityId),
  );

  const emailActs = allActs.filter(
    (act) =>
      act.type === "email" &&
      act.orgId === orgId &&
      recipientActivityIds.has(act.id),
  );
  emailActs.sort((a, b) => a.id.localeCompare(b.id));

  // Determine which step this is
  const clickedIdx = emailActs.findIndex((act) => act.id === activityId);
  if (clickedIdx === -1) return 0;
  const stepNumber = clickedIdx + 1;

  const steps = (await dbStore.marketingSequenceSteps.findForSequence(
    membership.sequenceId,
  )) as { id: string; stepNumber: number; orgId: string }[];
  const step = steps.find(
    (s) => s.stepNumber === stepNumber && s.orgId === orgId,
  );
  if (!step) return 0;

  const actions = (await dbStore.marketingSequenceReplyActions.findForStep(
    step.id,
  )) as {
    orgId: string;
    actionType: string;
    actionConfig: {
      field?: string;
      value?: string;
      subject?: string;
      body?: string | null;
      dueDateOffsetDays?: number;
    };
  }[];
  const matchingActions = actions.filter((act) => act.orgId === orgId);

  let executedCount = 0;
  for (const act of matchingActions) {
    if (act.actionType === "field_update") {
      const field = act.actionConfig?.field;
      const value = act.actionConfig?.value;
      if (field && value !== undefined) {
        if (recordTypeLower === "lead" && dbStore.leads) {
          const lead = await dbStore.leads.findOne(actLink.targetId);
          if (lead) {
            // biome-ignore lint/suspicious/noExplicitAny: casting safe
            const leadAny = lead as any;
            const beforeVal = field.startsWith("custom.")
              ? (leadAny.custom as Record<string, unknown>)?.[
                  field.substring(7)
                ]
              : leadAny[field];

            if (field.startsWith("custom.")) {
              const customField = field.substring(7);
              const newCustom = {
                ...(leadAny.custom || {}),
                [customField]: value,
              };
              await dbStore.leads.update(actLink.targetId, {
                custom: newCustom,
              });
            } else {
              await dbStore.leads.update(actLink.targetId, { [field]: value });
            }

            await dbStore.auditLogs.insert({
              orgId,
              recordId: actLink.targetId,
              recordType: "lead",
              action: "reply_trigger_field_update",
              userId: "00000000-0000-0000-0000-000000000000",
              changes: {
                [field]: { before: beforeVal, after: value },
              },
            });
            executedCount++;
          }
        } else if (recordTypeLower === "contact" && dbStore.contacts) {
          const contact = await dbStore.contacts.findOne(actLink.targetId);
          if (contact) {
            // biome-ignore lint/suspicious/noExplicitAny: casting safe
            const contactAny = contact as any;
            const beforeVal = field.startsWith("custom.")
              ? (contactAny.custom as Record<string, unknown>)?.[
                  field.substring(7)
                ]
              : contactAny[field];

            if (field.startsWith("custom.")) {
              const customField = field.substring(7);
              const newCustom = {
                ...(contactAny.custom || {}),
                [customField]: value,
              };
              await dbStore.contacts.update(actLink.targetId, {
                custom: newCustom,
              });
            } else {
              await dbStore.contacts.update(actLink.targetId, {
                [field]: value,
              });
            }

            await dbStore.auditLogs.insert({
              orgId,
              recordId: actLink.targetId,
              recordType: "contact",
              action: "reply_trigger_field_update",
              userId: "00000000-0000-0000-0000-000000000000",
              changes: {
                [field]: { before: beforeVal, after: value },
              },
            });
            executedCount++;
          }
        }
      }
    } else if (act.actionType === "create_task") {
      const subject = act.actionConfig?.subject || "Follow up on Reply";
      const body = act.actionConfig?.body || null;
      const offsetDays = act.actionConfig?.dueDateOffsetDays || 0;
      const dueDate = new Date(
        currentTime.getTime() + offsetDays * 24 * 60 * 60 * 1000,
      );

      const task = await dbStore.activities.insert({
        orgId,
        creatorId: "00000000-0000-0000-0000-000000000000",
        type: "task",
        subject,
        body,
        dueDate,
        createdAt: currentTime,
      });

      await dbStore.activityLinks.insert({
        orgId,
        activityId: task.id,
        targetType: actLink.targetType,
        targetId: actLink.targetId,
      });

      await dbStore.auditLogs.insert({
        orgId,
        recordId: membership.id,
        recordType: "marketing_sequence_memberships",
        action: "reply_trigger_create_task",
        userId: "00000000-0000-0000-0000-000000000000",
        changes: {
          taskId: { before: null, after: task.id },
          subject: { before: null, after: subject },
        },
      });
      executedCount++;
    }
  }

  if (executedCount > 0) {
    await dbStore.auditLogs.insert({
      orgId,
      recordId: membership.id,
      recordType: "marketing_sequence_memberships",
      action: "reply_trigger_executed",
      userId: "00000000-0000-0000-0000-000000000000",
      changes: {
        executedActionsCount: { before: 0, after: executedCount },
      },
    });
  }

  return executedCount;
}

export function parseUtmParams(urlStr: string) {
  try {
    const url = new URL(urlStr);
    return {
      utmSource: url.searchParams.get("utm_source") || null,
      utmMedium: url.searchParams.get("utm_medium") || null,
      utmCampaign: url.searchParams.get("utm_campaign") || null,
      utmTerm: url.searchParams.get("utm_term") || null,
      utmContent: url.searchParams.get("utm_content") || null,
    };
  } catch {
    const getParam = (name: string) => {
      const match = urlStr.match(new RegExp(`[?&]${name}=([^&#]*)`));
      return match ? decodeURIComponent(match[1]) : null;
    };
    return {
      utmSource: getParam("utm_source"),
      utmMedium: getParam("utm_medium"),
      utmCampaign: getParam("utm_campaign"),
      utmTerm: getParam("utm_term"),
      utmContent: getParam("utm_content"),
    };
  }
}

export interface UnsubscribeAnalyticsInput {
  unsubscribes: {
    id: string;
    reason: string;
    trackerId: string;
    orgId: string;
  }[];
  trackers: { id: string; activityId: string; orgId: string }[];
  links: { activityId: string; targetId: string; orgId: string }[];
  memberships: {
    sequenceId: string;
    recordId: string;
    status: string;
    orgId: string;
  }[];
  sequences: { id: string; name: string; orgId: string }[];
}

export interface UnsubscribeAnalyticsResult {
  totalUnsubscribes: number;
  reasonBreakdown: { reason: string; count: number; percentage: string }[];
  sequenceBreakdown: {
    sequenceId: string;
    sequenceName: string;
    count: number;
    percentage: string;
  }[];
}

export function calculateUnsubscribeAnalytics(
  params: UnsubscribeAnalyticsInput,
): UnsubscribeAnalyticsResult {
  const { unsubscribes, trackers, links, memberships, sequences } = params;

  const trackerMap = new Map(trackers.map((t) => [t.id, t.activityId]));
  const linkMap = new Map(links.map((l) => [l.activityId, l.targetId]));
  const sequenceMap = new Map(sequences.map((s) => [s.id, s.name]));

  const reasonCounts: Record<string, number> = {
    frequency: 0,
    relevance: 0,
    not_requested: 0,
    other: 0,
  };

  const sequenceCounts = new Map<string, number>();

  for (const unsub of unsubscribes) {
    if (unsub.reason in reasonCounts) {
      reasonCounts[unsub.reason]++;
    } else {
      reasonCounts.other++;
    }

    const activityId = trackerMap.get(unsub.trackerId);
    if (activityId) {
      const targetId = linkMap.get(activityId);
      if (targetId) {
        const matchingMemberships = memberships.filter(
          (m) => m.recordId === targetId,
        );
        let selectedSeqId = "";
        const unsubMembership = matchingMemberships.find(
          (m) => m.status === "unsubscribed",
        );
        if (unsubMembership) {
          selectedSeqId = unsubMembership.sequenceId;
        } else if (matchingMemberships.length > 0) {
          selectedSeqId = matchingMemberships[0].sequenceId;
        }

        if (selectedSeqId) {
          sequenceCounts.set(
            selectedSeqId,
            (sequenceCounts.get(selectedSeqId) || 0) + 1,
          );
        }
      }
    }
  }

  const total = unsubscribes.length;
  const reasonBreakdown = Object.entries(reasonCounts).map(
    ([reason, count]) => ({
      reason,
      count,
      percentage: total > 0 ? `${((count / total) * 100).toFixed(1)}%` : "0.0%",
    }),
  );

  const sequenceBreakdown = Array.from(sequenceCounts.entries()).map(
    ([seqId, count]) => ({
      sequenceId: seqId,
      sequenceName: sequenceMap.get(seqId) || "Unknown Sequence",
      count,
      percentage: total > 0 ? `${((count / total) * 100).toFixed(1)}%` : "0.0%",
    }),
  );

  return {
    totalUnsubscribes: total,
    reasonBreakdown,
    sequenceBreakdown,
  };
}

export interface LinkEngagementInput {
  clicks: {
    id: string;
    trackerId: string;
    clickedUrl: string;
    orgId: string;
  }[];
  trackers: { id: string; activityId: string; orgId: string }[];
  activities: { id: string; type: string; orgId: string }[];
  activityLinks: {
    activityId: string;
    targetId: string;
    targetType: string;
    orgId: string;
  }[];
  memberships: {
    sequenceId: string;
    recordId: string;
    status: string;
    orgId: string;
  }[];
  steps: {
    id: string;
    sequenceId: string;
    stepNumber: number;
    name?: string;
    orgId: string;
  }[];
  sequenceId: string;
}

export interface LinkPerformanceMetric {
  clickedUrl: string;
  stepId: string;
  stepName: string;
  clickCount: number;
  percentage: string;
}

export interface LinkEngagementResult {
  totalTrackedClicks: number;
  linkPerformance: LinkPerformanceMetric[];
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

export interface OpenAnalyticsInput {
  opens: { id: string; trackerId: string; deviceType: string; orgId: string }[];
  trackers: { id: string; activityId: string; orgId: string }[];
  activities: { id: string; type: string; orgId: string }[];
  activityLinks: {
    id: string;
    activityId: string;
    targetId: string;
    targetType: string;
    orgId: string;
  }[];
  memberships: {
    id: string;
    sequenceId: string;
    recordId: string;
    orgId: string;
  }[];
  steps: {
    id: string;
    name?: string;
    stepNumber: number;
    sequenceId: string;
    orgId: string;
  }[];
  sequenceId: string;
}

export interface DevicePerformanceMetric {
  deviceType: string;
  openCount: number;
  percentage: string;
}

export interface StepOpenRateMetric {
  stepId: string;
  stepName: string;
  totalSent: number;
  uniqueOpens: number;
  openRate: string;
}

export interface OpenAnalyticsResult {
  totalUniqueOpens: number;
  totalTrackedOpens: number;
  devicePerformance: DevicePerformanceMetric[];
  stepOpenRates: StepOpenRateMetric[];
}

export function calculateOpenAnalytics(
  params: OpenAnalyticsInput,
): OpenAnalyticsResult {
  const {
    opens,
    trackers,
    activities,
    activityLinks,
    memberships,
    steps,
    sequenceId,
  } = params;

  const seqMemberships = memberships.filter((m) => m.sequenceId === sequenceId);
  const seqSteps = steps.filter((s) => s.sequenceId === sequenceId);

  // 1. Map trackerId -> activityId
  const trackerToActivity = new Map<string, string>();
  for (const t of trackers) {
    trackerToActivity.set(t.id, t.activityId);
  }

  // 2. Build activityToStep mapping
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

  // 3. Count total sent (activities) per step
  const stepSentCount = new Map<string, number>();
  for (const step of seqSteps) {
    stepSentCount.set(step.id, 0);
  }
  for (const [actId, stepInfo] of activityToStep.entries()) {
    stepSentCount.set(stepInfo.id, (stepSentCount.get(stepInfo.id) || 0) + 1);
  }

  // 4. Group open events by trackerId to calculate unique opens
  const uniqueTrackerOpens = new Set<string>();
  const stepUniqueOpens = new Map<string, Set<string>>();
  for (const step of seqSteps) {
    stepUniqueOpens.set(step.id, new Set<string>());
  }

  const deviceCounts = new Map<string, number>();
  let totalTrackedOpens = 0;

  for (const op of opens) {
    const activityId = trackerToActivity.get(op.trackerId);
    if (activityId) {
      const stepInfo = activityToStep.get(activityId);
      if (stepInfo) {
        // Unique opens globally
        uniqueTrackerOpens.add(op.trackerId);

        // Unique opens per step
        const stepUnique = stepUniqueOpens.get(stepInfo.id);
        if (stepUnique) {
          stepUnique.add(op.trackerId);
        }

        // Device type counts
        const devType = op.deviceType || "desktop";
        deviceCounts.set(devType, (deviceCounts.get(devType) || 0) + 1);

        totalTrackedOpens++;
      }
    }
  }

  const totalUniqueOpens = uniqueTrackerOpens.size;

  // Calculate device performance breakdown
  const devicePerformance: DevicePerformanceMetric[] = Array.from(
    deviceCounts.entries(),
  ).map(([deviceType, count]) => ({
    deviceType,
    openCount: count,
    percentage:
      totalTrackedOpens > 0
        ? `${((count / totalTrackedOpens) * 100).toFixed(1)}%`
        : "0.0%",
  }));
  devicePerformance.sort((a, b) => b.openCount - a.openCount);

  // Calculate step open rates
  const stepOpenRates: StepOpenRateMetric[] = seqSteps.map((step) => {
    const totalSent = stepSentCount.get(step.id) || 0;
    const uniqueOpens = stepUniqueOpens.get(step.id)?.size || 0;
    return {
      stepId: step.id,
      stepName: step.name || `Step ${step.stepNumber}`,
      totalSent,
      uniqueOpens,
      openRate:
        totalSent > 0
          ? `${((uniqueOpens / totalSent) * 100).toFixed(1)}%`
          : "0.0%",
    };
  });

  return {
    totalUniqueOpens,
    totalTrackedOpens,
    devicePerformance,
    stepOpenRates,
  };
}

export interface ReplyAnalyticsInput {
  replies: {
    id: string;
    trackerId: string;
    sentiment: string;
    orgId: string;
  }[];
  trackers: { id: string; activityId: string; orgId: string }[];
  activities: { id: string; type: string; orgId: string }[];
  activityLinks: {
    id: string;
    activityId: string;
    targetId: string;
    targetType: string;
    orgId: string;
  }[];
  memberships: {
    id: string;
    sequenceId: string;
    recordId: string;
    orgId: string;
  }[];
  steps: {
    id: string;
    name?: string;
    stepNumber: number;
    sequenceId: string;
    orgId: string;
  }[];
  sequenceId: string;
}

export interface SentimentPerformanceMetric {
  sentiment: string;
  replyCount: number;
  percentage: string;
}

export interface StepReplyRateMetric {
  stepId: string;
  stepName: string;
  totalSent: number;
  uniqueReplies: number;
  replyRate: string;
}

export interface ReplyAnalyticsResult {
  totalUniqueReplies: number;
  totalTrackedReplies: number;
  replyRate: string;
  sentimentPerformance: SentimentPerformanceMetric[];
  stepReplyRates: StepReplyRateMetric[];
}

export function calculateReplyAnalytics(
  params: ReplyAnalyticsInput,
): ReplyAnalyticsResult {
  const {
    replies,
    trackers,
    activities,
    activityLinks,
    memberships,
    steps,
    sequenceId,
  } = params;

  const seqMemberships = memberships.filter((m) => m.sequenceId === sequenceId);
  const seqSteps = steps.filter((s) => s.sequenceId === sequenceId);

  // 1. Map trackerId -> activityId
  const trackerToActivity = new Map<string, string>();
  for (const t of trackers) {
    trackerToActivity.set(t.id, t.activityId);
  }

  // 2. Build activityToStep mapping
  const activityToStep = new Map<string, { id: string; name: string }>();
  for (const m of seqMemberships) {
    const linksForRecord = activityLinks.filter(
      (link) =>
        link.targetId === m.recordId &&
        (link.targetType.toLowerCase() === "lead" ||
          link.targetType.toLowerCase() === "contact"),
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

  // 3. Count total sent (activities) per step
  const stepSentCount = new Map<string, number>();
  for (const step of seqSteps) {
    stepSentCount.set(step.id, 0);
  }
  for (const [actId, stepInfo] of activityToStep.entries()) {
    stepSentCount.set(stepInfo.id, (stepSentCount.get(stepInfo.id) || 0) + 1);
  }

  // 4. Group reply events by trackerId to calculate unique replies
  const uniqueTrackerReplies = new Set<string>();
  const stepUniqueReplies = new Map<string, Set<string>>();
  for (const step of seqSteps) {
    stepUniqueReplies.set(step.id, new Set<string>());
  }

  const sentimentCounts = new Map<string, number>();
  let totalTrackedReplies = 0;

  for (const rep of replies) {
    const activityId = trackerToActivity.get(rep.trackerId);
    if (activityId) {
      const stepInfo = activityToStep.get(activityId);
      if (stepInfo) {
        // Unique replies globally
        uniqueTrackerReplies.add(rep.trackerId);

        // Unique replies per step
        const stepUnique = stepUniqueReplies.get(stepInfo.id);
        if (stepUnique) {
          stepUnique.add(rep.trackerId);
        }

        // Sentiment type counts
        const sentiment = rep.sentiment || "neutral";
        sentimentCounts.set(
          sentiment,
          (sentimentCounts.get(sentiment) || 0) + 1,
        );

        totalTrackedReplies++;
      }
    }
  }

  const totalUniqueReplies = uniqueTrackerReplies.size;
  const totalSentGlobally = Array.from(stepSentCount.values()).reduce(
    (a, b) => a + b,
    0,
  );

  // Calculate sentiment performance breakdown
  const sentimentPerformance: SentimentPerformanceMetric[] = Array.from(
    sentimentCounts.entries(),
  ).map(([sentiment, count]) => ({
    sentiment,
    replyCount: count,
    percentage:
      totalTrackedReplies > 0
        ? `${((count / totalTrackedReplies) * 100).toFixed(1)}%`
        : "0.0%",
  }));
  // Ensure all standard sentiments have entries even if 0
  const sentiments = ["positive", "neutral", "negative"];
  for (const s of sentiments) {
    if (!sentimentPerformance.some((x) => x.sentiment === s)) {
      sentimentPerformance.push({
        sentiment: s,
        replyCount: 0,
        percentage: "0.0%",
      });
    }
  }
  sentimentPerformance.sort((a, b) => b.replyCount - a.replyCount);

  // Calculate step reply rates
  const stepReplyRates: StepReplyRateMetric[] = seqSteps.map((step) => {
    const totalSent = stepSentCount.get(step.id) || 0;
    const uniqueReplies = stepUniqueReplies.get(step.id)?.size || 0;
    return {
      stepId: step.id,
      stepName: step.name || `Step ${step.stepNumber}`,
      totalSent,
      uniqueReplies,
      replyRate:
        totalSent > 0
          ? `${((uniqueReplies / totalSent) * 100).toFixed(1)}%`
          : "0.0%",
    };
  });

  return {
    totalUniqueReplies,
    totalTrackedReplies,
    replyRate:
      totalSentGlobally > 0
        ? `${((totalUniqueReplies / totalSentGlobally) * 100).toFixed(1)}%`
        : "0.0%",
    sentimentPerformance,
    stepReplyRates,
  };
}

export interface BounceAnalyticsInput {
  bounces: {
    id: string;
    trackerId: string;
    eventType: string;
    bounceType: string;
    orgId: string;
  }[];
  trackers: { id: string; activityId: string; orgId: string }[];
  activities: {
    id: string;
    type: string;
    orgId: string;
    createdAt: Date | string;
  }[];
  activityLinks: {
    id: string;
    activityId: string;
    targetId: string;
    targetType: string;
    orgId: string;
  }[];
  memberships: {
    id: string;
    sequenceId: string;
    recordId: string;
    orgId: string;
  }[];
  steps: {
    id: string;
    name?: string;
    stepNumber: number;
    sequenceId: string;
    orgId: string;
  }[];
  sequenceId: string;
}

export interface BounceTypePerformanceMetric {
  bounceType: string;
  eventCount: number;
  percentage: string;
}

export interface StepBounceRateMetric {
  stepId: string;
  stepName: string;
  totalSent: number;
  uniqueBounces: number;
  bounceRate: string;
}

export interface BounceAnalyticsResult {
  totalBounces: number;
  totalComplaints: number;
  totalUniqueBouncedTrackers: number;
  bounceRate: string;
  bounceTypePerformance: BounceTypePerformanceMetric[];
  stepBounceRates: StepBounceRateMetric[];
}

export function calculateBounceAnalytics(
  params: BounceAnalyticsInput,
): BounceAnalyticsResult {
  const {
    bounces,
    trackers,
    activities,
    activityLinks,
    memberships,
    steps,
    sequenceId,
  } = params;

  const seqMemberships = memberships.filter((m) => m.sequenceId === sequenceId);
  const seqSteps = steps.filter((s) => s.sequenceId === sequenceId);

  // 1. Map trackerId -> activityId
  const trackerToActivity = new Map<string, string>();
  for (const t of trackers) {
    trackerToActivity.set(t.id, t.activityId);
  }

  // 2. Build activityToStep mapping
  const activityToStep = new Map<string, { id: string; name: string }>();
  for (const m of seqMemberships) {
    const linksForRecord = activityLinks.filter(
      (link) =>
        link.targetId === m.recordId &&
        (link.targetType.toLowerCase() === "lead" ||
          link.targetType.toLowerCase() === "contact"),
    );
    const activityIds = linksForRecord.map((l) => l.activityId);
    const emailActs = activities.filter(
      (act) => act.type === "email" && activityIds.includes(act.id),
    );
    emailActs.sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );

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

  // 3. Count total sent (activities) per step
  const stepSentCount = new Map<string, number>();
  for (const step of seqSteps) {
    stepSentCount.set(step.id, 0);
  }
  for (const [actId, stepInfo] of activityToStep.entries()) {
    stepSentCount.set(stepInfo.id, (stepSentCount.get(stepInfo.id) || 0) + 1);
  }

  // 4. Group bounce events by trackerId to calculate unique bounces
  const uniqueTrackerBounces = new Set<string>();
  const stepUniqueBounces = new Map<string, Set<string>>();
  for (const step of seqSteps) {
    stepUniqueBounces.set(step.id, new Set<string>());
  }

  const bounceTypeCounts = new Map<string, number>();
  let totalBounces = 0;
  let totalComplaints = 0;
  let totalTrackedEvents = 0;

  for (const b of bounces) {
    const activityId = trackerToActivity.get(b.trackerId);
    if (activityId) {
      const stepInfo = activityToStep.get(activityId);
      if (stepInfo) {
        // Unique bounces globally
        uniqueTrackerBounces.add(b.trackerId);

        // Unique bounces per step
        const stepUnique = stepUniqueBounces.get(stepInfo.id);
        if (stepUnique) {
          stepUnique.add(b.trackerId);
        }

        // Event type counts
        if (b.eventType === "complaint") {
          totalComplaints++;
        } else {
          totalBounces++;
        }

        // Bounce type counts
        const bounceType = b.bounceType || "hard";
        bounceTypeCounts.set(
          bounceType,
          (bounceTypeCounts.get(bounceType) || 0) + 1,
        );

        totalTrackedEvents++;
      }
    }
  }

  const totalUniqueBouncedTrackers = uniqueTrackerBounces.size;
  const totalSentGlobally = Array.from(stepSentCount.values()).reduce(
    (a, b) => a + b,
    0,
  );

  // Calculate bounce type performance breakdown
  const bounceTypePerformance: BounceTypePerformanceMetric[] = Array.from(
    bounceTypeCounts.entries(),
  ).map(([bType, count]) => ({
    bounceType: bType,
    eventCount: count,
    percentage:
      totalTrackedEvents > 0
        ? `${((count / totalTrackedEvents) * 100).toFixed(1)}%`
        : "0.0%",
  }));

  // Ensure all standard bounce types have entries even if 0
  const bounceTypes = ["hard", "soft", "spam_complaint"];
  for (const bt of bounceTypes) {
    if (!bounceTypePerformance.some((x) => x.bounceType === bt)) {
      bounceTypePerformance.push({
        bounceType: bt,
        eventCount: 0,
        percentage: "0.0%",
      });
    }
  }
  bounceTypePerformance.sort((a, b) => b.eventCount - a.eventCount);

  // Calculate step bounce rates
  const stepBounceRates: StepBounceRateMetric[] = seqSteps.map((step) => {
    const totalSent = stepSentCount.get(step.id) || 0;
    const uniqueBounces = stepUniqueBounces.get(step.id)?.size || 0;
    return {
      stepId: step.id,
      stepName: step.name || `Step ${step.stepNumber}`,
      totalSent,
      uniqueBounces,
      bounceRate:
        totalSent > 0
          ? `${((uniqueBounces / totalSent) * 100).toFixed(1)}%`
          : "0.0%",
    };
  });

  return {
    totalBounces,
    totalComplaints,
    totalUniqueBouncedTrackers,
    bounceRate:
      totalSentGlobally > 0
        ? `${((totalUniqueBouncedTrackers / totalSentGlobally) * 100).toFixed(1)}%`
        : "0.0%",
    bounceTypePerformance,
    stepBounceRates,
  };
}

export interface ReadTimeAnalyticsInput {
  readTimeEvents: {
    id: string;
    trackerId: string;
    durationMs: number;
    readClassification: string;
    orgId: string;
  }[];
  trackers: {
    id: string;
    activityId: string;
    openCount: number;
    orgId: string;
  }[];
  activities: {
    id: string;
    orgId: string;
    type?: string;
    createdAt?: Date | string;
  }[];
  activityLinks: {
    activityId: string;
    targetId: string;
    targetType: string;
    orgId: string;
  }[];
  memberships: {
    id: string;
    sequenceId: string;
    recordId: string;
    orgId: string;
  }[];
  steps: {
    id: string;
    name?: string;
    stepNumber: number;
    sequenceId: string;
    orgId: string;
  }[];
  sequenceId: string;
}

export interface ReadTimePerformanceMetric {
  classification: string;
  eventCount: number;
  percentage: string;
}

export interface StepReadTimeStatsMetric {
  stepId: string;
  stepName: string;
  openCount: number;
  glancedCount: number;
  skimmedCount: number;
  readCount: number;
}

export interface ReadTimeAnalyticsResult {
  totalGlanced: number;
  totalSkimmed: number;
  totalRead: number;
  averageReadTimeMs: number;
  readTimeClassificationPerformance: ReadTimePerformanceMetric[];
  stepReadTimeStats: StepReadTimeStatsMetric[];
}

export function calculateReadTimeAnalytics(
  params: ReadTimeAnalyticsInput,
): ReadTimeAnalyticsResult {
  const {
    readTimeEvents,
    trackers,
    activities,
    activityLinks,
    memberships,
    steps,
    sequenceId,
  } = params;

  const seqMemberships = memberships.filter((m) => m.sequenceId === sequenceId);
  const seqSteps = steps.filter((s) => s.sequenceId === sequenceId);

  // 1. Map trackerId -> activityId and trackerId -> trackerObj
  const trackerToActivity = new Map<string, string>();
  for (const t of trackers) {
    trackerToActivity.set(t.id, t.activityId);
  }

  // 2. Build activityToStep mapping
  const activityToStep = new Map<string, { id: string; name: string }>();
  for (const m of seqMemberships) {
    const linksForRecord = activityLinks.filter(
      (link) =>
        link.targetId === m.recordId &&
        (link.targetType.toLowerCase() === "lead" ||
          link.targetType.toLowerCase() === "contact"),
    );
    const activityIds = linksForRecord.map((l) => l.activityId);
    const emailActs = activities.filter(
      (act) => act.type === "email" && activityIds.includes(act.id),
    );
    emailActs.sort(
      (a, b) =>
        new Date(a.createdAt || "").getTime() -
        new Date(b.createdAt || "").getTime(),
    );

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

  // 3. Count total openCount per step and total glanced, skimmed, read
  const stepOpenCount = new Map<string, number>();
  const stepGlancedCount = new Map<string, number>();
  const stepSkimmedCount = new Map<string, number>();
  const stepReadCount = new Map<string, number>();

  for (const step of seqSteps) {
    stepOpenCount.set(step.id, 0);
    stepGlancedCount.set(step.id, 0);
    stepSkimmedCount.set(step.id, 0);
    stepReadCount.set(step.id, 0);
  }

  // Trackers' openCount can be accumulated by step
  for (const t of trackers) {
    const activityId = t.activityId;
    if (activityId) {
      const stepInfo = activityToStep.get(activityId);
      if (stepInfo) {
        stepOpenCount.set(
          stepInfo.id,
          (stepOpenCount.get(stepInfo.id) || 0) + t.openCount,
        );
      }
    }
  }

  let totalGlanced = 0;
  let totalSkimmed = 0;
  let totalRead = 0;
  let totalDurationMs = 0;
  let totalEventsCount = 0;

  for (const event of readTimeEvents) {
    const activityId = trackerToActivity.get(event.trackerId);
    if (activityId) {
      const stepInfo = activityToStep.get(activityId);
      if (stepInfo) {
        totalEventsCount++;
        totalDurationMs += event.durationMs;

        const classification = event.readClassification;
        if (classification === "glanced") {
          totalGlanced++;
          stepGlancedCount.set(
            stepInfo.id,
            (stepGlancedCount.get(stepInfo.id) || 0) + 1,
          );
        } else if (classification === "skimmed") {
          totalSkimmed++;
          stepSkimmedCount.set(
            stepInfo.id,
            (stepSkimmedCount.get(stepInfo.id) || 0) + 1,
          );
        } else if (classification === "read") {
          totalRead++;
          stepReadCount.set(
            stepInfo.id,
            (stepReadCount.get(stepInfo.id) || 0) + 1,
          );
        }
      }
    }
  }

  const averageReadTimeMs =
    totalEventsCount > 0 ? Math.round(totalDurationMs / totalEventsCount) : 0;

  // Build performance breakdown
  const readTimeClassificationPerformance: ReadTimePerformanceMetric[] = [
    {
      classification: "glanced",
      eventCount: totalGlanced,
      percentage:
        totalEventsCount > 0
          ? `${((totalGlanced / totalEventsCount) * 100).toFixed(1)}%`
          : "0.0%",
    },
    {
      classification: "skimmed",
      eventCount: totalSkimmed,
      percentage:
        totalEventsCount > 0
          ? `${((totalSkimmed / totalEventsCount) * 100).toFixed(1)}%`
          : "0.0%",
    },
    {
      classification: "read",
      eventCount: totalRead,
      percentage:
        totalEventsCount > 0
          ? `${((totalRead / totalEventsCount) * 100).toFixed(1)}%`
          : "0.0%",
    },
  ];

  // Calculate step read time stats
  const stepReadTimeStats: StepReadTimeStatsMetric[] = seqSteps.map((step) => {
    return {
      stepId: step.id,
      stepName: step.name || `Step ${step.stepNumber}`,
      openCount: stepOpenCount.get(step.id) || 0,
      glancedCount: stepGlancedCount.get(step.id) || 0,
      skimmedCount: stepSkimmedCount.get(step.id) || 0,
      readCount: stepReadCount.get(step.id) || 0,
    };
  });

  return {
    totalGlanced,
    totalSkimmed,
    totalRead,
    averageReadTimeMs,
    readTimeClassificationPerformance,
    stepReadTimeStats,
  };
}

export interface EngagementScoreEventsInput {
  openCount: number;
  clickCount: number;
  replyCount: number;
  readTimeEvents: { durationMs: number; readClassification: string }[];
  bounceEvents: { eventType: string; bounceType: string }[];
  isUnsubscribed: boolean;
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

export async function processSequenceMembershipScoreTriggers(
  // biome-ignore lint/suspicious/noExplicitAny: dbStore dynamic reference
  db: any,
  orgId: string,
  membershipId: string,
): Promise<{ triggeredCount: number; executedActions: string[] }> {
  const membership =
    await db.marketingSequenceMemberships.findOne(membershipId);
  if (!membership || membership.status !== "active") {
    return { triggeredCount: 0, executedActions: [] };
  }

  const triggers = await db.marketingSequenceScoreTriggers.findForSequence(
    membership.sequenceId,
  );
  const currentScore = membership.engagementScore ?? 0;

  const executedActions: string[] = [];
  let triggeredCount = 0;

  for (const trigger of triggers) {
    if (currentScore >= trigger.scoreThreshold) {
      triggeredCount++;
      const actionType = trigger.actionType;

      if (actionType === "change_lead_status") {
        if (membership.recordType === "lead") {
          const lead = await db.leads.findOne(membership.recordId);
          const targetStatus = trigger.actionConfig.status || "Qualified";
          if (lead && lead.status !== targetStatus) {
            await db.leads.update(membership.recordId, {
              status: targetStatus,
            });
            executedActions.push(`change_lead_status:${targetStatus}`);
          }
        }
      } else if (actionType === "auto_exit") {
        if (membership.status === "active") {
          await db.marketingSequenceMemberships.update(membershipId, {
            status: "completed",
          });
          executedActions.push("auto_exit");
        }
      } else if (actionType === "notify_owner") {
        let ownerId = "system";
        let targetType: "Lead" | "Contact" = "Lead";
        if (membership.recordType === "lead") {
          const lead = await db.leads.findOne(membership.recordId);
          if (lead) ownerId = lead.ownerId;
          targetType = "Lead";
        } else {
          const contact = await db.contacts.findOne(membership.recordId);
          if (contact) ownerId = contact.ownerId;
          targetType = "Contact";
        }

        const subject =
          trigger.actionConfig.subject || "[High Engagement] Follow up needed";
        const body =
          trigger.actionConfig.body ||
          `Recipient has reached score ${currentScore}.`;

        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + 1);

        const task = await db.activities.insert({
          orgId,
          creatorId: "system",
          type: "task",
          subject,
          body,
          dueDate,
        });

        await db.activityLinks.insert({
          orgId,
          activityId: task.id,
          targetType,
          targetId: membership.recordId,
        });

        executedActions.push(`notify_owner:${ownerId}`);
      }
    }
  }

  return { triggeredCount, executedActions };
}

export function validateHexColor(color: string): boolean {
  return /^#[0-9A-Fa-f]{6}$/.test(color);
}

export interface FolderNode {
  id: string;
  parentFolderId: string | null;
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

export async function cloneMarketingSequence(
  // biome-ignore lint/suspicious/noExplicitAny: dbStore dynamic reference
  dbStore: any,
  sequenceId: string,
  newName: string,
  orgId: string,
  // biome-ignore lint/suspicious/noExplicitAny: returned cloned object
): Promise<any> {
  const sequence = await dbStore.marketingSequences.findOne(sequenceId);
  if (!sequence) {
    throw new Error("Sequence not found");
  }
  if (sequence.orgId !== orgId) {
    throw new Error("RLS Isolation Violation: Tenant mismatch.");
  }

  const clonedSequence = await dbStore.marketingSequences.insert({
    orgId,
    name: newName,
    description: sequence.description,
    status: "draft",
    sendingWindowStart: sequence.sendingWindowStart || null,
    sendingWindowEnd: sequence.sendingWindowEnd || null,
    sendingDays: sequence.sendingDays || null,
    allowReenrollment: sequence.allowReenrollment || false,
    reenrollmentMinDays: sequence.reenrollmentMinDays || null,
    dailySendLimit: sequence.dailySendLimit || null,
    senderType: sequence.senderType || "system",
    senderUserId: sequence.senderUserId || null,
    folderId: sequence.folderId || null,
  });

  const steps =
    await dbStore.marketingSequenceSteps.findForSequence(sequenceId);
  steps.sort(
    (a: { stepNumber: number }, b: { stepNumber: number }) =>
      a.stepNumber - b.stepNumber,
  );

  for (const step of steps) {
    const clonedStep = await dbStore.marketingSequenceSteps.insert({
      orgId,
      sequenceId: clonedSequence.id,
      stepNumber: step.stepNumber,
      delayDays: step.delayDays,
      templateId: step.templateId,
      waitCondition: step.waitCondition || null,
      replyToStepNumber: step.replyToStepNumber || null,
    });

    if (dbStore.marketingSequenceStepBranches) {
      const branch = await dbStore.marketingSequenceStepBranches.findForStep(
        step.id,
      );
      if (branch) {
        await dbStore.marketingSequenceStepBranches.insert({
          orgId,
          stepId: clonedStep.id,
          branchType: branch.branchType,
          evaluationWindowDays: branch.evaluationWindowDays,
          trueNextStepNumber: branch.trueNextStepNumber,
          falseNextStepNumber: branch.falseNextStepNumber,
        });
      }
    }

    if (dbStore.marketingSequenceStepSplitTests) {
      const st = await dbStore.marketingSequenceStepSplitTests.findForStep(
        step.id,
      );
      if (st) {
        await dbStore.marketingSequenceStepSplitTests.insert({
          orgId,
          stepId: clonedStep.id,
          variantTemplateId: st.variantTemplateId,
          splitWeight: st.splitWeight,
          isActive: st.isActive,
          autoPromoteWinner: st.autoPromoteWinner,
          minSendsToEvaluate: st.minSendsToEvaluate,
          evaluationMetric: st.evaluationMetric,
        });
      }
    }

    if (dbStore.marketingSequenceLinkActions) {
      const linkActions =
        await dbStore.marketingSequenceLinkActions.findForStep(step.id);
      for (const la of linkActions) {
        await dbStore.marketingSequenceLinkActions.insert({
          orgId,
          stepId: clonedStep.id,
          targetUrl: la.targetUrl,
          actionType: la.actionType,
          actionConfig: la.actionConfig,
        });
      }
    }

    if (dbStore.marketingSequenceOpenActions) {
      const openActions =
        await dbStore.marketingSequenceOpenActions.findForStep(step.id);
      for (const oa of openActions) {
        await dbStore.marketingSequenceOpenActions.insert({
          orgId,
          stepId: clonedStep.id,
          actionType: oa.actionType,
          actionConfig: oa.actionConfig,
        });
      }
    }

    if (dbStore.marketingSequenceReplyActions) {
      const replyActions =
        await dbStore.marketingSequenceReplyActions.findForStep(step.id);
      for (const ra of replyActions) {
        await dbStore.marketingSequenceReplyActions.insert({
          orgId,
          stepId: clonedStep.id,
          actionType: ra.actionType,
          actionConfig: ra.actionConfig,
        });
      }
    }
  }

  if (dbStore.marketingSequenceExitTriggers) {
    const exitTriggers =
      await dbStore.marketingSequenceExitTriggers.findForSequence(sequenceId);
    for (const et of exitTriggers) {
      await dbStore.marketingSequenceExitTriggers.insert({
        orgId,
        sequenceId: clonedSequence.id,
        triggerType: et.triggerType,
        criteria: et.criteria,
        isActive: et.isActive,
      });
    }
  }

  if (dbStore.marketingSequenceTagMappings) {
    const mappings =
      await dbStore.marketingSequenceTagMappings.findForSequence(sequenceId);
    for (const m of mappings) {
      await dbStore.marketingSequenceTagMappings.insert({
        orgId,
        sequenceId: clonedSequence.id,
        tagId: m.tagId,
      });
    }
  }

  return clonedSequence;
}

export async function archiveMarketingSequence(
  // biome-ignore lint/suspicious/noExplicitAny: dbStore dynamic reference
  dbStore: any,
  sequenceId: string,
  orgId: string,
  // biome-ignore lint/suspicious/noExplicitAny: returned updated object
): Promise<any> {
  const sequence = await dbStore.marketingSequences.findOne(sequenceId);
  if (!sequence) {
    throw new Error("Sequence not found");
  }
  if (sequence.orgId !== orgId) {
    throw new Error("RLS Isolation Violation: Tenant mismatch.");
  }

  const updatedSequence = await dbStore.marketingSequences.update(sequenceId, {
    status: "archived",
  });

  if (dbStore.marketingSequenceMemberships?.findMany) {
    const memberships = await dbStore.marketingSequenceMemberships.findMany();
    const seqMemberships = memberships.filter(
      // biome-ignore lint/suspicious/noExplicitAny: membership dynamic typing
      (m: any) => m.sequenceId === sequenceId && m.orgId === orgId,
    );
    for (const m of seqMemberships) {
      if (m.status === "active" || m.status === "paused") {
        await dbStore.marketingSequenceMemberships.update(m.id, {
          status: "completed",
        });
      }
    }
  }

  return updatedSequence;
}

export async function purgeMarketingSequence(
  // biome-ignore lint/suspicious/noExplicitAny: dbStore dynamic reference
  dbStore: any,
  sequenceId: string,
  orgId: string,
): Promise<boolean> {
  const sequence = await dbStore.marketingSequences.findOne(sequenceId);
  if (!sequence) {
    throw new Error("Sequence not found");
  }
  if (sequence.orgId !== orgId) {
    throw new Error("RLS Isolation Violation: Tenant mismatch.");
  }
  if (sequence.status !== "archived") {
    throw new Error("Only archived sequences can be purged");
  }

  // 1. Delete all step-level children and the steps themselves
  if (dbStore.marketingSequenceSteps) {
    const steps =
      await dbStore.marketingSequenceSteps.findForSequence(sequenceId);
    for (const step of steps) {
      // Branches
      if (dbStore.marketingSequenceStepBranches) {
        const branch = await dbStore.marketingSequenceStepBranches.findForStep(
          step.id,
        );
        if (branch) {
          await dbStore.marketingSequenceStepBranches.delete(branch.id);
        }
      }
      // Split Tests
      if (dbStore.marketingSequenceStepSplitTests) {
        const st = await dbStore.marketingSequenceStepSplitTests.findForStep(
          step.id,
        );
        if (st) {
          await dbStore.marketingSequenceStepSplitTests.delete(st.id);
        }
      }
      // Open Actions
      if (dbStore.marketingSequenceOpenActions) {
        const openActions =
          await dbStore.marketingSequenceOpenActions.findForStep(step.id);
        for (const oa of openActions) {
          await dbStore.marketingSequenceOpenActions.delete(oa.id);
        }
      }
      // Reply Actions
      if (dbStore.marketingSequenceReplyActions) {
        const replyActions =
          await dbStore.marketingSequenceReplyActions.findForStep(step.id);
        for (const ra of replyActions) {
          await dbStore.marketingSequenceReplyActions.delete(ra.id);
        }
      }
      // Link Actions
      if (dbStore.marketingSequenceLinkActions) {
        const linkActions =
          await dbStore.marketingSequenceLinkActions.findForStep(step.id);
        for (const la of linkActions) {
          await dbStore.marketingSequenceLinkActions.delete(la.id);
        }
      }
      // Step itself
      await dbStore.marketingSequenceSteps.delete(step.id);
    }
  }

  // 2. Exit triggers
  if (dbStore.marketingSequenceExitTriggers) {
    const exitTriggers =
      await dbStore.marketingSequenceExitTriggers.findForSequence(sequenceId);
    for (const et of exitTriggers) {
      await dbStore.marketingSequenceExitTriggers.delete(et.id);
    }
  }

  // 3. Tag mappings
  if (dbStore.marketingSequenceTagMappings) {
    const mappings =
      await dbStore.marketingSequenceTagMappings.findForSequence(sequenceId);
    for (const m of mappings) {
      await dbStore.marketingSequenceTagMappings.delete(m.id);
    }
  }

  // 4. Memberships
  if (dbStore.marketingSequenceMemberships?.findMany) {
    const memberships = await dbStore.marketingSequenceMemberships.findMany();
    const seqMemberships = memberships.filter(
      // biome-ignore lint/suspicious/noExplicitAny: membership dynamic typing
      (m: any) => m.sequenceId === sequenceId && m.orgId === orgId,
    );
    for (const m of seqMemberships) {
      await dbStore.marketingSequenceMemberships.delete(m.id);
    }
  }

  // 5. Sequence itself
  await dbStore.marketingSequences.delete(sequenceId);

  return true;
}

export async function pauseMarketingSequence(
  // biome-ignore lint/suspicious/noExplicitAny: dbStore dynamic reference
  dbStore: any,
  sequenceId: string,
  orgId: string,
  // biome-ignore lint/suspicious/noExplicitAny: returned updated object
): Promise<any> {
  const sequence = await dbStore.marketingSequences.findOne(sequenceId);
  if (!sequence) {
    throw new Error("Sequence not found");
  }
  if (sequence.orgId !== orgId) {
    throw new Error("RLS Isolation Violation: Tenant mismatch.");
  }
  if (sequence.status !== "active") {
    throw new Error("Only active sequences can be paused");
  }

  const updatedSequence = await dbStore.marketingSequences.update(sequenceId, {
    status: "paused",
  });

  return updatedSequence;
}

export async function resumeMarketingSequence(
  // biome-ignore lint/suspicious/noExplicitAny: dbStore dynamic reference
  dbStore: any,
  sequenceId: string,
  orgId: string,
  // biome-ignore lint/suspicious/noExplicitAny: returned updated object
): Promise<any> {
  const sequence = await dbStore.marketingSequences.findOne(sequenceId);
  if (!sequence) {
    throw new Error("Sequence not found");
  }
  if (sequence.orgId !== orgId) {
    throw new Error("RLS Isolation Violation: Tenant mismatch.");
  }
  if (sequence.status !== "paused") {
    throw new Error("Only paused sequences can be resumed");
  }

  const updatedSequence = await dbStore.marketingSequences.update(sequenceId, {
    status: "active",
  });

  return updatedSequence;
}
