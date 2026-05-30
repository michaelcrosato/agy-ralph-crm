import { mockDb, withTenant } from "@crm/db";
import type {
  AutoConversionCriteria,
  ConvertedEntities,
  ConvertLeadWithMappingsInput,
  LeadConversionInput,
  LeaderboardOpportunityInput,
  LeaderboardQuotaInput,
  LeaderboardRepInput,
  LeaderboardRepResult,
  LeaderboardResult,
  LeadRecord,
  MergeLeadsInput,
  RoutingMatchResult,
  RuleEntryInput,
  ScoringRuleInput,
} from "../../types";
import { calculateSlaStatus, isDateInPeriod } from "../shared";

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

export function evaluateLeadAssignment(
  lead: Record<string, unknown>,
  entries: RuleEntryInput[],
): RoutingMatchResult | null {
  const sortedEntries = [...entries].sort((a, b) => a.sortOrder - b.sortOrder);

  for (const entry of sortedEntries) {
    let match = true;
    for (const cond of entry.criteria) {
      let leadValue: unknown;
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

export function calculateLeadScore(
  lead: Record<string, unknown>,
  rules: ScoringRuleInput[],
): number {
  let score = 0;
  const activeRules = rules.filter((r) => r.isActive === 1);

  for (const rule of activeRules) {
    let match = true;
    for (const cond of rule.criteria) {
      let val: unknown;
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

export function convertLeadWithMappings(
  input: ConvertLeadWithMappingsInput,
): ConvertedEntities {
  const { lead, opportunityName, opportunityAmount, mappings } = input;
  const entities = convertLead({ lead, opportunityName, opportunityAmount });

  for (const mapping of mappings) {
    const { sourceLeadField, targetObjectType, targetField } = mapping;

    let value: unknown;
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

interface SlaTarget {
  id: string;
  isActive: number;
  maxResponseTimeMinutes: number;
}

interface SlaTracker {
  id: string;
  targetId: string;
  leadId: string;
  status: string;
  createdAt: string | Date;
  respondedAt: string | Date | null;
}

export async function checkSlabreaches(
  // biome-ignore lint/suspicious/noExplicitAny: dbStore dynamic reference
  dbStore: any,
  orgId: string,
  currentTime: Date,
): Promise<number> {
  return await withTenant(orgId, mockDb, async () => {
    // 1. Fetch active SLA targets
    const allTargets = (await dbStore.leadSlaTargets.findMany()) as SlaTarget[];
    const activeTargets = allTargets.filter((t) => t.isActive === 1);

    // 2. Fetch pending SLA trackers
    const allTrackers =
      (await dbStore.leadSlaTrackers.findMany()) as SlaTracker[];
    const pendingTrackers = allTrackers.filter((t) => t.status === "Pending");

    let breachCount = 0;

    for (const tracker of pendingTrackers) {
      const target = activeTargets.find((t) => t.id === tracker.targetId);
      if (!target) continue;

      const statusInfo = calculateSlaStatus(
        new Date(tracker.createdAt),
        target.maxResponseTimeMinutes,
        tracker.respondedAt ? new Date(tracker.respondedAt) : null,
        currentTime,
      );

      if (statusInfo.status === "Breached") {
        breachCount++;

        // Update tracker to Breached status
        await dbStore.leadSlaTrackers.update(tracker.id, {
          status: "Breached",
          responseTimeMinutes: statusInfo.responseTimeMinutes,
        });

        // Find the lead
        const lead = await dbStore.leads.findOne(tracker.leadId);
        if (lead) {
          const custom = lead.custom ? { ...lead.custom } : {};
          if (custom.slaAlertSent) {
            continue; // Already processed/alerted, skip to prevent double alert
          }

          // Mark SLA alert as sent in custom metadata
          custom.slaAlertSent = true;
          await dbStore.leads.update(lead.id, { custom });

          // Generate "System Notification" activity
          await dbStore.activities.insert({
            orgId,
            creatorId: "system",
            type: "task",
            subject: "SLA Breach Notification",
            body: `Lead with ID ${lead.id} has breached SLA of ${target.maxResponseTimeMinutes} minutes.`,
            dueDate: null,
            custom: { slaBreached: true },
          });

          // Generate mock outbound email log (activity with type "email")
          const emailSubject = `SLA Breach Alert: Lead ${lead.email || lead.id} response time exceeded`;
          const emailBody = `Lead ${lead.email || lead.id} is breaching maximum response time of ${target.maxResponseTimeMinutes} minutes. Please follow up immediately.`;

          const emailAct = await dbStore.activities.insert({
            orgId,
            creatorId: "system",
            type: "email",
            subject: emailSubject,
            body: emailBody,
            dueDate: null,
            custom: {
              from: "system@crm.com",
              to: [lead.email || "rep@crm.com"],
              cc: [],
              bcc: [],
            },
          });

          // Persist a mock outbound email log record via auditLog
          await dbStore.auditLogs.insert({
            orgId,
            recordId: emailAct.id,
            recordType: "EmailLog",
            action: "create",
            userId: "system",
            changes: null,
          });
        }
      }
    }

    return breachCount;
  });
}
