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
