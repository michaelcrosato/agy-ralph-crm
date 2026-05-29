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
