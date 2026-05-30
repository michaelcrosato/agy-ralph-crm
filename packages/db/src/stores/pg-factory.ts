import { and, eq, sql } from "drizzle-orm";
import { getTableConfig } from "drizzle-orm/pg-core";
import { genId } from "../_ids";
import { validateCustomFields } from "../_jsonb";
import { assertTenantOwns } from "../_rls";
import { getActiveOrgId } from "../_tenant";
import * as schema from "../schema";
import { computeAuditHash, GENESIS_HASH, stableStringify } from "./audit-hash";

export function createPgStore(
  _tableName: string,
  table: any,
  prefix: string,
  getDbClient: () => any,
) {
  return {
    findMany: async () => {
      const db = getDbClient();
      const orgId = getActiveOrgId();
      let query = db.select().from(table);
      if ("orgId" in table) {
        query = query.where(eq(table.orgId, orgId));
      }
      return query;
    },
    findOne: async (id: string) => {
      const db = getDbClient();
      const orgId = getActiveOrgId();
      let query = db.select().from(table);
      if ("orgId" in table) {
        query = query.where(and(eq(table.id, id), eq(table.orgId, orgId)));
      } else {
        query = query.where(eq(table.id, id));
      }
      const [row] = await query;
      return row || null;
    },
    insert: async (data: any) => {
      const db = getDbClient();
      const orgId = getActiveOrgId();
      const customTables = [
        "leads",
        "accounts",
        "contacts",
        "opportunities",
        "tickets",
      ];
      if (customTables.includes(_tableName)) {
        await validateCustomFields(orgId, _tableName, data.custom || {});
      }
      const newRow = {
        ...data,
        id: data.id || genId(prefix),
      };
      if ("orgId" in table) {
        if (!newRow.orgId) {
          newRow.orgId = orgId;
        }
        assertTenantOwns(newRow);
      }
      if ("ownerId" in table && !newRow.ownerId) {
        newRow.ownerId = "user-a";
      }
      if ("createdAt" in table && !newRow.createdAt) {
        newRow.createdAt = new Date();
      }

      if (_tableName === "auditLogs") {
        const [lastLog] = await db
          .select({
            seq: schema.auditLogs.seq,
            hash: schema.auditLogs.hash,
          })
          .from(schema.auditLogs)
          .where(eq(schema.auditLogs.orgId, orgId))
          .orderBy(
            sql`${schema.auditLogs.createdAt} desc, ${schema.auditLogs.id} desc`,
          )
          .limit(1);

        const prevHash = lastLog?.hash || GENESIS_HASH;
        const seq = lastLog ? (lastLog.seq || 0) + 1 : 0;
        const createdAt =
          newRow.createdAt instanceof Date
            ? newRow.createdAt
            : new Date(newRow.createdAt);

        const recordToHash = {
          orgId,
          recordId: newRow.recordId,
          recordType: newRow.recordType,
          action: newRow.action,
          userId: newRow.userId,
          changes: newRow.changes,
          createdAt: createdAt.toISOString(),
        };

        newRow.seq = seq;
        newRow.prevHash = prevHash;
        newRow.hash = computeAuditHash(recordToHash, seq, prevHash);
      }

      await db.insert(table).values(newRow);
      return newRow;
    },
    update: async (id: string, updates: any) => {
      const db = getDbClient();
      const orgId = getActiveOrgId();
      let findQuery = db.select().from(table);
      if ("orgId" in table) {
        findQuery = findQuery.where(
          and(eq(table.id, id), eq(table.orgId, orgId)),
        );
      } else {
        findQuery = findQuery.where(eq(table.id, id));
      }
      const [oldRow] = await findQuery;
      if (!oldRow) return null;

      if ("orgId" in table && "orgId" in oldRow) {
        assertTenantOwns(oldRow);
      }

      const customTables = [
        "leads",
        "accounts",
        "contacts",
        "opportunities",
        "tickets",
      ];
      if (customTables.includes(_tableName) && updates.custom !== undefined) {
        await validateCustomFields(orgId, _tableName, updates.custom || {});
      }

      await db.update(table).set(updates).where(eq(table.id, id));
      return { ...oldRow, ...updates };
    },
    delete: async (id: string) => {
      const db = getDbClient();
      const orgId = getActiveOrgId();
      let findQuery = db.select().from(table);
      if ("orgId" in table) {
        findQuery = findQuery.where(
          and(eq(table.id, id), eq(table.orgId, orgId)),
        );
      } else {
        findQuery = findQuery.where(eq(table.id, id));
      }
      const [oldRow] = await findQuery;
      if (!oldRow) return false;

      if ("orgId" in table && "orgId" in oldRow) {
        assertTenantOwns(oldRow);
      }

      await db.delete(table).where(eq(table.id, id));
      return true;
    },
    ...(_tableName === "currencies"
      ? {
          findByIsoCode: async (isoCode: string) => {
            const db = getDbClient();
            const orgId = getActiveOrgId();
            const [row] = await db
              .select()
              .from(table)
              .where(
                and(
                  eq(sql`lower(${table.isoCode})`, isoCode.toLowerCase()),
                  eq(table.orgId, orgId),
                ),
              );
            return row || null;
          },
        }
      : ({} as any)),
  };
}

export const storeMetadata: Record<string, { table: any; prefix: string }> = {
  customEntityTypes: { table: schema.customEntityTypes, prefix: "cetype" },
  customEntityRecords: { table: schema.customEntityRecords, prefix: "cerec" },
  embeddings: { table: schema.embeddings, prefix: "embed" },
  users: { table: schema.users, prefix: "user" },
  memberships: { table: schema.memberships, prefix: "membership" },
  leads: { table: schema.leads, prefix: "lead" },
  accounts: { table: schema.accounts, prefix: "account" },
  contacts: { table: schema.contacts, prefix: "contact" },
  opportunities: { table: schema.opportunities, prefix: "opp" },
  auditLogs: { table: schema.auditLogs, prefix: "log" },
  fieldDefinitions: { table: schema.fieldDefinitions, prefix: "field" },
  layoutDefinitions: { table: schema.layoutDefinitions, prefix: "layout" },
  workflows: { table: schema.workflows, prefix: "workflow" },
  tickets: { table: schema.tickets, prefix: "ticket" },

  reports: { table: schema.reports, prefix: "report" },
  products: { table: schema.products, prefix: "product" },
  pricebooks: { table: schema.pricebooks, prefix: "pricebook" },
  pricebookEntries: { table: schema.pricebookEntries, prefix: "pbe" },
  opportunityProducts: { table: schema.opportunityProducts, prefix: "line" },
  quotas: { table: schema.quotas, prefix: "quota" },
  stageForecastMappings: { table: schema.stageForecastMappings, prefix: "sfm" },
  forecastAdjustments: { table: schema.forecastAdjustments, prefix: "fa" },
  stageProbabilities: { table: schema.stageProbabilities, prefix: "sp" },
  webhooks: { table: schema.webhooks, prefix: "webhook" },
  webhookDeliveries: { table: schema.webhookDeliveries, prefix: "delivery" },
  documentTemplates: { table: schema.documentTemplates, prefix: "template" },
  mergedDocuments: { table: schema.mergedDocuments, prefix: "merged" },
  subscriptions: { table: schema.subscriptions, prefix: "subscription" },
  invoices: { table: schema.invoices, prefix: "invoice" },
  webhookOutbox: { table: schema.webhookOutbox, prefix: "outbox" },
  webhookDlq: { table: schema.webhookDlq, prefix: "dlq" },
  opportunityApprovals: {
    table: schema.opportunityApprovals,
    prefix: "approval",
  },
  opportunityApprovalSteps: {
    table: schema.opportunityApprovalSteps,
    prefix: "step",
  },
  commissions: { table: schema.commissions, prefix: "commission" },
  leadAssignmentRules: { table: schema.leadAssignmentRules, prefix: "rule" },
  leadAssignmentRuleEntries: {
    table: schema.leadAssignmentRuleEntries,
    prefix: "entry",
  },
  territories: { table: schema.territories, prefix: "territory" },
  territoryMembers: { table: schema.territoryMembers, prefix: "member" },
  opportunitySplits: { table: schema.opportunitySplits, prefix: "split" },
  campaigns: { table: schema.campaigns, prefix: "campaign" },
  campaignMembers: { table: schema.campaignMembers, prefix: "member" },
  opportunityStageHistory: {
    table: schema.opportunityStageHistory,
    prefix: "history",
  },

  campaignInfluence: { table: schema.campaignInfluence, prefix: "cinf" },
  contracts: { table: schema.contracts, prefix: "contract" },
  leadSlaTargets: { table: schema.leadSlaTargets, prefix: "target" },
  leadSlaTrackers: { table: schema.leadSlaTrackers, prefix: "tracker" },
  accountTeams: { table: schema.accountTeams, prefix: "team" },
  opportunityTeams: { table: schema.opportunityTeams, prefix: "team" },
  leadScoringRules: { table: schema.leadScoringRules, prefix: "rule" },
  opportunityCompetitors: {
    table: schema.opportunityCompetitors,
    prefix: "opcomp",
  },
  leadConversionMappings: {
    table: schema.leadConversionMappings,
    prefix: "mapping",
  },
  currencies: { table: schema.currencies, prefix: "currency" },
  opportunityStageGates: {
    table: schema.opportunityStageGates,
    prefix: "gate",
  },
  stageGuidance: { table: schema.stageGuidance, prefix: "guidance" },
  opportunityProductSchedules: {
    table: schema.opportunityProductSchedules,
    prefix: "schedule",
  },
  leadAutoConversionRules: {
    table: schema.leadAutoConversionRules,
    prefix: "conversion-rule",
  },
  opportunityStageDurationRules: {
    table: schema.opportunityStageDurationRules,
    prefix: "duration-rule",
  },
  contactConsentPreferences: {
    table: schema.contactConsentPreferences,
    prefix: "consent",
  },
  emailCalendarSyncSettings: {
    table: schema.emailCalendarSyncSettings,
    prefix: "settings",
  },
  emailCalendarSyncRuns: { table: schema.emailCalendarSyncRuns, prefix: "run" },
  esignatureRequests: { table: schema.esignatureRequests, prefix: "esign" },
  surveys: { table: schema.surveys, prefix: "survey" },
  surveyResponses: { table: schema.surveyResponses, prefix: "sres" },
  slaPolicies: { table: schema.slaPolicies, prefix: "sla" },
  ticketMilestones: { table: schema.ticketMilestones, prefix: "milestone" },
  kbCategories: { table: schema.kbCategories, prefix: "kbcat" },
  kbArticles: { table: schema.kbArticles, prefix: "kbart" },
  ticketComments: { table: schema.ticketComments, prefix: "tcom" },
  ticketTags: { table: schema.ticketTags, prefix: "ttag" },
  ticketTagLinks: { table: schema.ticketTagLinks, prefix: "tlink" },
  ticketAssignmentRules: {
    table: schema.ticketAssignmentRules,
    prefix: "trule",
  },
  ticketAssignmentRuleEntries: {
    table: schema.ticketAssignmentRuleEntries,
    prefix: "trent",
  },
  ticketEscalationRules: {
    table: schema.ticketEscalationRules,
    prefix: "tescr",
  },
  ticketEscalations: { table: schema.ticketEscalations, prefix: "tesc" },
  ticketMacros: { table: schema.ticketMacros, prefix: "tmac" },
  schemaMigrations: { table: schema.schemaMigrations, prefix: "mig" },
  scheduledReports: { table: schema.scheduledReports, prefix: "sr" },
  scheduledReportRuns: { table: schema.scheduledReportRuns, prefix: "srr" },
  picklistDependencies: { table: schema.picklistDependencies, prefix: "pldep" },
  validationRules: { table: schema.validationRules, prefix: "valrule" },
  emailTemplates: { table: schema.emailTemplates, prefix: "emailtpl" },
  emailTrackers: { table: schema.emailTrackers, prefix: "tracker" },
  marketingSegments: { table: schema.marketingSegments, prefix: "seg" },
  marketingSequences: { table: schema.marketingSequences, prefix: "seq" },
  marketingSequenceSteps: {
    table: schema.marketingSequenceSteps,
    prefix: "step",
  },
  marketingSequenceMemberships: {
    table: schema.marketingSequenceMemberships,
    prefix: "memb",
  },
  marketingSequenceExitTriggers: {
    table: schema.marketingSequenceExitTriggers,
    prefix: "trig",
  },

  marketingSequenceGlobalVariables: {
    table: schema.marketingSequenceGlobalVariables,
    prefix: "msvg",
  },
  marketingSequenceTags: {
    table: schema.marketingSequenceTags,
    prefix: "msta",
  },
  marketingSequenceTagMappings: {
    table: schema.marketingSequenceTagMappings,
    prefix: "mstm",
  },
  marketingSequenceStepSplitTests: {
    table: schema.marketingSequenceStepSplitTests,
    prefix: "split",
  },
  marketingSequenceAbAllocations: {
    table: schema.marketingSequenceAbAllocations,
    prefix: "alloc",
  },
  marketingSequenceStepBranches: {
    table: schema.marketingSequenceStepBranches,
    prefix: "branch",
  },
  marketingSequenceGoals: {
    table: schema.marketingSequenceGoals,
    prefix: "goal",
  },
  marketingSequenceConversions: {
    table: schema.marketingSequenceConversions,
    prefix: "conv",
  },
  marketingSequenceSuppressions: {
    table: schema.marketingSequenceSuppressions,
    prefix: "supp",
  },
  marketingSequenceExclusions: {
    table: schema.marketingSequenceExclusions,
    prefix: "excl",
  },
  marketingSequenceCaps: { table: schema.marketingSequenceCaps, prefix: "cap" },
  marketingSequenceLinkActions: {
    table: schema.marketingSequenceLinkActions,
    prefix: "act",
  },
  marketingSequenceOpenActions: {
    table: schema.marketingSequenceOpenActions,
    prefix: "act",
  },
  marketingSequenceReplyActions: {
    table: schema.marketingSequenceReplyActions,
    prefix: "act",
  },
  emailClickEvents: { table: schema.emailClickEvents, prefix: "ev" },
  emailUnsubscribes: { table: schema.emailUnsubscribes, prefix: "unsub" },
  emailOpenEvents: { table: schema.emailOpenEvents, prefix: "op" },
  emailReplyEvents: { table: schema.emailReplyEvents, prefix: "rep" },
  emailBounceEvents: { table: schema.emailBounceEvents, prefix: "bnc" },
  emailReadTimeEvents: { table: schema.emailReadTimeEvents, prefix: "rdt" },
};

export async function clearPgDb(db: any) {
  const tableNames = Object.values(storeMetadata).map((meta) => {
    try {
      return getTableConfig(meta.table).name;
    } catch {
      return null;
    }
  });
  const validNames = tableNames.filter(Boolean);
  if (validNames.length > 0) {
    const query = `TRUNCATE TABLE ${validNames.map((name) => `"${name}"`).join(", ")} CASCADE;`;
    await db.execute(sql.raw(query));
  }
}
