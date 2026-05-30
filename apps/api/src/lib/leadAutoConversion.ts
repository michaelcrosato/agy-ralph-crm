import {
  calculateLeadScore,
  convertLead,
  evaluateLeadAutoConversion,
} from "@crm/core";
import { dbStore } from "@crm/db";
import { triggerOutboundWebhooks } from "./webhooks";

/**
 * Evaluates active auto-conversion rules for a lead, recalculates its
 * score, and performs conversion (account + contact + opportunity) if
 * rules match. Idempotent on already-Converted leads.
 */
export async function checkAndRunLeadAutoConversion(
  leadId: string,
  orgId: string,
  userId: string,
): Promise<{
  converted: boolean;
  accountId?: string;
  contactId?: string;
  opportunityId?: string;
} | null> {
  const lead = await dbStore.leads.findOne(leadId);
  if (!lead || lead.status === "Converted") return null;

  const scoringRules = await dbStore.leadScoringRules.findMany();
  const score = calculateLeadScore(
    lead as unknown as Record<string, unknown>,
    scoringRules.map((r) => ({
      id: r.id,
      isActive: r.isActive,
      scoreValue: r.scoreValue,
      criteria: r.criteria,
    })),
  );

  const rules = await dbStore.leadAutoConversionRules.findMany();
  const activeRule = rules.find((r) => r.isActive === 1);
  if (!activeRule) return null;

  const matches = evaluateLeadAutoConversion(
    { status: lead.status, custom: lead.custom },
    score,
    activeRule.criteria,
  );

  if (!matches) return null;

  const _mappings = await dbStore.leadConversionMappings.findMany();
  const entities = convertLead({
    lead: {
      id: lead.id,
      orgId: lead.orgId,
      ownerId: lead.ownerId,
      status: lead.status,
      email: lead.email,
      company: lead.company,
      custom: lead.custom,
    },
    opportunityName:
      activeRule.createOpportunity === 1
        ? `${lead.company || lead.email}'s Opportunity`
        : undefined,
    opportunityAmount: "0.00",
  });

  const account = await dbStore.accounts.insert({
    orgId,
    ownerId: userId,
    name: entities.account.name,
    domain: null,
    custom: entities.account.custom,
  });

  const contact = await dbStore.contacts.insert({
    orgId,
    ownerId: userId,
    accountId: account.id,
    firstName: entities.contact.firstName,
    lastName: entities.contact.lastName,
    email: entities.contact.email,
    custom: entities.contact.custom,
  });

  let opportunityId: string | undefined;
  if (entities.opportunity && activeRule.createOpportunity === 1) {
    const opp = await dbStore.opportunities.insert({
      orgId,
      ownerId: userId,
      accountId: account.id,
      name: entities.opportunity.name,
      stage: activeRule.opportunityStage,
      amount: "0.00",
      closeDate: null,
      custom: null,
    });
    opportunityId = opp.id;
  }

  await dbStore.leads.update(leadId, {
    status: "Converted",
    convertedAccountId: account.id,
    convertedContactId: contact.id,
  });

  await dbStore.auditLogs.insert({
    orgId,
    recordId: leadId,
    recordType: "Lead",
    action: "update",
    userId,
    changes: {
      status: { before: lead.status, after: "Converted" },
    },
  });

  await triggerOutboundWebhooks(orgId, "lead.converted", {
    leadId,
    accountId: account.id,
    contactId: contact.id,
    opportunityId,
  });

  return {
    converted: true,
    accountId: account.id,
    contactId: contact.id,
    opportunityId,
  };
}
