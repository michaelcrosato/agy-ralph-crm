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
