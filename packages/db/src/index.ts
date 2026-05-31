import { store } from "./_store";
import { stores } from "./stores";

export { genId } from "./_ids";
export { JsonbValidationError, validateCustomFields } from "./_jsonb";
export { assertTenantOwns } from "./_rls";
export * from "./_store";
export {
  assertSessionTenant,
  getActiveOrgId,
  mockDb,
  tenantStorage,
  withTenant,
} from "./_tenant";

import { createDbClient } from "./client";

let pgDbInstance: any = null;
function getDb() {
  if (!pgDbInstance) {
    const connStr =
      process.env.DB_URL || "postgres://postgres:postgres@localhost:5432/crm";
    pgDbInstance = createDbClient(connStr);
  }
  return pgDbInstance;
}

export const pgDb: any = {
  execute: async (query: any) => {
    const db = getDb();
    return await db.execute(query);
  },
  transaction: async (run: any) => {
    const db = getDb();
    return await db.transaction(async (tx: any) => {
      const txHarness = {
        execute: async (q: any) => await tx.execute(q),
        transaction: async (r: any) => await tx.transaction(() => r(txHarness)),
      };
      return await run(txHarness as any);
    });
  },
};

export * from "./schema";

export const dbStore = new Proxy({} as any, {
  get(_target, prop: string) {
    if (prop === "clear") {
      return () => {
        store.marketingSegments = [];
        store.marketingSequences = [];
        store.marketingSequenceSteps = [];
        store.marketingSequenceMemberships = [];
        store.marketingSequenceExitTriggers = [];
        store.marketingSequenceStepSplitTests = [];
        store.marketingSequenceStepBranches = [];
        store.marketingSequenceGoals = [];
        store.marketingSequenceConversions = [];
        store.marketingSequenceSuppressions = [];
        store.marketingSequenceExclusions = [];
        store.marketingSequenceScoreTriggers = [];
        store.marketingSequenceGlobalVariables = [];
        store.marketingSequenceFolders = [];
        store.marketingSequenceTags = [];
        store.marketingSequenceTagMappings = [];
        store.marketingSequenceAbAllocations = [];
        store.marketingSequenceCaps = [];

        store.marketingSequenceLinkActions = [];
        store.marketingSequenceOpenActions = [];
        store.marketingSequenceReplyActions = [];
        store.emailClickEvents = [];
        store.emailUnsubscribes = [];
        store.emailOpenEvents = [];
        store.emailReplyEvents = [];
        store.emailBounceEvents = [];
        store.emailReadTimeEvents = [];

        store.emailTemplates = [];
        store.emailTrackers = [];
        store.picklistDependencies = [];
        store.validationRules = [];
        store.stageForecastMappings = [];
        store.forecastAdjustments = [];
        store.users = [];
        store.memberships = [];
        store.leads = [];

        store.accounts = [];
        store.contacts = [];
        store.opportunities = [];
        store.auditLogs = [];
        store.fieldDefinitions = [];
        store.layoutDefinitions = [];
        store.workflows = [];
        store.tickets = [];
        store.activities = [];
        store.activityLinks = [];
        store.reports = [];
        store.products = [];
        store.pricebooks = [];
        store.pricebookEntries = [];
        store.opportunityProducts = [];
        store.quotas = [];
        store.stageProbabilities = [];
        store.webhooks = [];
        store.webhookDeliveries = [];
        store.documentTemplates = [];
        store.mergedDocuments = [];
        store.subscriptions = [];
        store.invoices = [];
        store.webhookOutbox = [];
        store.webhookDlq = [];
        store.opportunityApprovals = [];
        store.opportunityApprovalSteps = [];
        store.commissions = [];
        store.leadAssignmentRules = [];
        store.leadAssignmentRuleEntries = [];
        store.territories = [];
        store.territoryMembers = [];
        store.opportunitySplits = [];
        store.campaigns = [];
        store.campaignMembers = [];
        store.opportunityStageHistory = [];
        store.opportunityContactRoles = [];
        store.campaignInfluence = [];
        store.contracts = [];
        store.leadSlaTargets = [];
        store.leadSlaTrackers = [];
        store.accountTeams = [];
        store.opportunityTeams = [];
        store.opportunityProductSchedules = [];
        store.leadScoringRules = [];
        store.opportunityCompetitors = [];
        store.leadConversionMappings = [];
        store.currencies = [];
        store.opportunityStageGates = [];
        store.stageGuidance = [];
        store.leadAutoConversionRules = [];
        store.opportunityStageDurationRules = [];
        store.contactConsentPreferences = [];
        store.emailCalendarSyncSettings = [];
        store.emailCalendarSyncRuns = [];
        store.esignatureRequests = [];
        store.surveys = [];
        store.surveyResponses = [];
        store.slaPolicies = [];
        store.ticketMilestones = [];
        store.kbCategories = [];
        store.kbArticles = [];
        store.ticketComments = [];
        store.ticketTags = [];
        store.ticketTagLinks = [];
        store.ticketAssignmentRules = [];
        store.ticketAssignmentRuleEntries = [];
        store.ticketEscalationRules = [];
        store.ticketEscalations = [];
        store.ticketMacros = [];
        store.schemaMigrations = [];
        store.scheduledReports = [];
        store.scheduledReportRuns = [];

        if (process.env.DB_DRIVER === "pg") {
          return (stores as any).clear();
        }
      };
    }
    const storeObj = (stores as any)[prop];
    const isMutationTracked =
      prop === "accounts" ||
      prop === "contacts" ||
      prop === "leads" ||
      prop === "activities" ||
      prop === "activityLinks";
    const isValidationCachable =
      prop === "picklistDependencies" || prop === "validationRules";
    if (storeObj && (isMutationTracked || isValidationCachable)) {
      return new Proxy(storeObj, {
        get(target, method: string) {
          const original = target[method];
          if (typeof original === "function") {
            if (
              method === "insert" ||
              method === "update" ||
              method === "delete"
            ) {
              return async (...args: any[]) => {
                const result = await original.apply(target, args);
                if (
                  isMutationTracked &&
                  (method === "insert" || method === "update")
                ) {
                  const callback = (globalThis as any).__crm_onMutationCallback;
                  if (result?.id && callback) {
                    callback(prop, result.id, result);
                  }
                }
                if (isValidationCachable) {
                  const valCallback = (globalThis as any)
                    .__crm_onValidationMutation;
                  if (valCallback) {
                    try {
                      valCallback(prop);
                    } catch (_e) {
                      // ignore callback errors
                    }
                  }
                }
                return result;
              };
            }
          }
          return original;
        },
      });
    }
    return storeObj;
  },
  ownKeys() {
    return Reflect.ownKeys(stores);
  },
  getOwnPropertyDescriptor(_target, _prop) {
    return {
      enumerable: true,
      configurable: true,
    };
  },
}) as typeof stores & { clear: () => void | Promise<void> };

export function registerMutationListener(
  cb: (entityType: string, id: string, data: any) => void,
) {
  const g = globalThis as any;
  g.__crm_onMutationCallbacks = g.__crm_onMutationCallbacks || [];

  // Prevent duplicate registration of identical or re-imported callbacks
  const cbStr = cb.toString();
  const exists = g.__crm_onMutationCallbacks.some(
    (existing: (...args: never) => unknown) => existing.toString() === cbStr,
  );
  if (exists) {
    return;
  }

  g.__crm_onMutationCallbacks.push(cb);
  g.__crm_onMutationCallback = (prop: string, id: string, data: any) => {
    for (const callback of g.__crm_onMutationCallbacks) {
      try {
        callback(prop, id, data);
      } catch (_e) {
        // ignore callback errors
      }
    }
  };
}
