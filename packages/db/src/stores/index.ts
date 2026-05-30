import { createDbClient } from "../client";
import { accountsStore } from "./accounts";
import { accountTeamsStore } from "./accountTeams";
import { activitiesStore } from "./activities";
import { activityLinksStore } from "./activityLinks";
import { auditLogsStore } from "./auditLogs";
import { campaignInfluenceStore } from "./campaignInfluence";
import { campaignMembersStore } from "./campaignMembers";
import { campaignsStore } from "./campaigns";
import { commissionsStore } from "./commissions";
import { contactConsentPreferencesStore } from "./contactConsentPreferences";
import { contactsStore } from "./contacts";
import { contractsStore } from "./contracts";
import { currenciesStore } from "./currencies";
import { documentTemplatesStore } from "./documentTemplates";
import { emailBounceEventsStore } from "./emailBounceEvents";
import { emailCalendarSyncRunsStore } from "./emailCalendarSyncRuns";
import { emailCalendarSyncSettingsStore } from "./emailCalendarSyncSettings";
import { emailClickEventsStore } from "./emailClickEvents";
import { emailOpenEventsStore } from "./emailOpenEvents";
import { emailReadTimeEventsStore } from "./emailReadTimeEvents";
import { emailReplyEventsStore } from "./emailReplyEvents";
import { emailTemplatesStore } from "./emailTemplates";
import { emailTrackersStore } from "./emailTrackers";
import { emailUnsubscribesStore } from "./emailUnsubscribes";
import { esignatureRequestsStore } from "./esignatureRequests";
import { fieldDefinitionsStore } from "./fieldDefinitions";
import { forecastAdjustmentsStore } from "./forecastAdjustments";
import { invoicesStore } from "./invoices";
import { kbArticlesStore } from "./kbArticles";
import { kbCategoriesStore } from "./kbCategories";
import { layoutDefinitionsStore } from "./layoutDefinitions";
import { leadAssignmentRuleEntriesStore } from "./leadAssignmentRuleEntries";
import { leadAssignmentRulesStore } from "./leadAssignmentRules";
import { leadAutoConversionRulesStore } from "./leadAutoConversionRules";
import { leadConversionMappingsStore } from "./leadConversionMappings";
import { leadScoringRulesStore } from "./leadScoringRules";
import { leadSlaTargetsStore } from "./leadSlaTargets";
import { leadSlaTrackersStore } from "./leadSlaTrackers";
import { leadsStore } from "./leads";
import { marketingSegmentsStore } from "./marketingSegments";
import { marketingSequenceAbAllocationsStore } from "./marketingSequenceAbAllocations";
import { marketingSequenceCapsStore } from "./marketingSequenceCaps";
import { marketingSequenceConversionsStore } from "./marketingSequenceConversions";
import { marketingSequenceExclusionsStore } from "./marketingSequenceExclusions";
import { marketingSequenceExitTriggersStore } from "./marketingSequenceExitTriggers";
import { marketingSequenceFoldersStore } from "./marketingSequenceFolders";
import { marketingSequenceGlobalVariablesStore } from "./marketingSequenceGlobalVariables";
import { marketingSequenceGoalsStore } from "./marketingSequenceGoals";
import { marketingSequenceLinkActionsStore } from "./marketingSequenceLinkActions";
import { marketingSequenceMembershipsStore } from "./marketingSequenceMemberships";
import { marketingSequenceOpenActionsStore } from "./marketingSequenceOpenActions";
import { marketingSequenceReplyActionsStore } from "./marketingSequenceReplyActions";
import { marketingSequenceScoreTriggersStore } from "./marketingSequenceScoreTriggers";
import { marketingSequenceStepBranchesStore } from "./marketingSequenceStepBranches";
import { marketingSequenceStepSplitTestsStore } from "./marketingSequenceStepSplitTests";
import { marketingSequenceStepsStore } from "./marketingSequenceSteps";
import { marketingSequenceSuppressionsStore } from "./marketingSequenceSuppressions";
import { marketingSequencesStore } from "./marketingSequences";
import { marketingSequenceTagMappingsStore } from "./marketingSequenceTagMappings";
import { marketingSequenceTagsStore } from "./marketingSequenceTags";
import { membershipsStore } from "./memberships";
import { mergedDocumentsStore } from "./mergedDocuments";
import { opportunitiesStore } from "./opportunities";
import { opportunityApprovalStepsStore } from "./opportunityApprovalSteps";
import { opportunityApprovalsStore } from "./opportunityApprovals";
import { opportunityCompetitorsStore } from "./opportunityCompetitors";
import { opportunityContactRolesStore } from "./opportunityContactRoles";
import { opportunityProductSchedulesStore } from "./opportunityProductSchedules";
import { opportunityProductsStore } from "./opportunityProducts";
import { opportunitySplitsStore } from "./opportunitySplits";
import { opportunityStageDurationRulesStore } from "./opportunityStageDurationRules";
import { opportunityStageGatesStore } from "./opportunityStageGates";
import { opportunityStageHistoryStore } from "./opportunityStageHistory";
import { opportunityTeamsStore } from "./opportunityTeams";
import { clearPgDb, createPgStore, storeMetadata } from "./pg-factory";
import { picklistDependenciesStore } from "./picklistDependencies";
import { pricebookEntriesStore } from "./pricebookEntries";
import { pricebooksStore } from "./pricebooks";
import { productsStore } from "./products";
import { quotasStore } from "./quotas";
import { reportsStore } from "./reports";
import { scheduledReportRunsStore } from "./scheduledReportRuns";
import { scheduledReportsStore } from "./scheduledReports";
import { schemaMigrationsStore } from "./schemaMigrations";
import { slaPoliciesStore } from "./slaPolicies";
import { stageForecastMappingsStore } from "./stageForecastMappings";
import { stageGuidanceStore } from "./stageGuidance";
import { stageProbabilitiesStore } from "./stageProbabilities";
import { subscriptionsStore } from "./subscriptions";
import { surveyResponsesStore } from "./surveyResponses";
import { surveysStore } from "./surveys";
import { territoriesStore } from "./territories";
import { territoryMembersStore } from "./territoryMembers";
import { ticketAssignmentRuleEntriesStore } from "./ticketAssignmentRuleEntries";
import { ticketAssignmentRulesStore } from "./ticketAssignmentRules";
import { ticketCommentsStore } from "./ticketComments";
import { ticketEscalationRulesStore } from "./ticketEscalationRules";
import { ticketEscalationsStore } from "./ticketEscalations";
import { ticketMacrosStore } from "./ticketMacros";
import { ticketMilestonesStore } from "./ticketMilestones";
import { ticketsStore } from "./tickets";
import { ticketTagLinksStore } from "./ticketTagLinks";
import { ticketTagsStore } from "./ticketTags";
import { usersStore } from "./users";
import { validationRulesStore } from "./validationRules";
import { webhookDeliveriesStore } from "./webhookDeliveries";
import { webhookDlqStore } from "./webhookDlq";
import { webhookOutboxStore } from "./webhookOutbox";
import { webhooksStore } from "./webhooks";
import { workflowsStore } from "./workflows";

let pgDb: any = null;
function getDb() {
  if (!pgDb) {
    const connStr =
      process.env.DB_URL || "postgres://postgres:postgres@localhost:5432/crm";
    pgDb = createDbClient(connStr);
  }
  return pgDb;
}

const mockStores = {
  users: usersStore,
  memberships: membershipsStore,
  leads: leadsStore,
  accounts: accountsStore,
  contacts: contactsStore,
  opportunities: opportunitiesStore,
  auditLogs: auditLogsStore,
  fieldDefinitions: fieldDefinitionsStore,
  layoutDefinitions: layoutDefinitionsStore,
  workflows: workflowsStore,
  tickets: ticketsStore,
  activities: activitiesStore,
  activityLinks: activityLinksStore,
  reports: reportsStore,
  products: productsStore,
  pricebooks: pricebooksStore,
  pricebookEntries: pricebookEntriesStore,
  opportunityProducts: opportunityProductsStore,
  quotas: quotasStore,
  stageForecastMappings: stageForecastMappingsStore,
  forecastAdjustments: forecastAdjustmentsStore,
  stageProbabilities: stageProbabilitiesStore,
  webhooks: webhooksStore,
  webhookDeliveries: webhookDeliveriesStore,
  documentTemplates: documentTemplatesStore,
  mergedDocuments: mergedDocumentsStore,
  subscriptions: subscriptionsStore,
  invoices: invoicesStore,
  webhookOutbox: webhookOutboxStore,
  webhookDlq: webhookDlqStore,
  opportunityApprovals: opportunityApprovalsStore,
  opportunityApprovalSteps: opportunityApprovalStepsStore,
  commissions: commissionsStore,
  leadAssignmentRules: leadAssignmentRulesStore,
  leadAssignmentRuleEntries: leadAssignmentRuleEntriesStore,
  territories: territoriesStore,
  territoryMembers: territoryMembersStore,
  opportunitySplits: opportunitySplitsStore,
  campaigns: campaignsStore,
  campaignMembers: campaignMembersStore,
  opportunityStageHistory: opportunityStageHistoryStore,
  opportunityContactRoles: opportunityContactRolesStore,
  campaignInfluence: campaignInfluenceStore,
  contracts: contractsStore,
  leadSlaTargets: leadSlaTargetsStore,
  leadSlaTrackers: leadSlaTrackersStore,
  accountTeams: accountTeamsStore,
  opportunityTeams: opportunityTeamsStore,
  leadScoringRules: leadScoringRulesStore,
  opportunityCompetitors: opportunityCompetitorsStore,
  leadConversionMappings: leadConversionMappingsStore,
  currencies: currenciesStore,
  opportunityStageGates: opportunityStageGatesStore,
  stageGuidance: stageGuidanceStore,
  opportunityProductSchedules: opportunityProductSchedulesStore,
  leadAutoConversionRules: leadAutoConversionRulesStore,
  opportunityStageDurationRules: opportunityStageDurationRulesStore,
  contactConsentPreferences: contactConsentPreferencesStore,
  emailCalendarSyncSettings: emailCalendarSyncSettingsStore,
  emailCalendarSyncRuns: emailCalendarSyncRunsStore,
  esignatureRequests: esignatureRequestsStore,
  surveys: surveysStore,
  surveyResponses: surveyResponsesStore,
  slaPolicies: slaPoliciesStore,
  ticketMilestones: ticketMilestonesStore,
  kbCategories: kbCategoriesStore,
  kbArticles: kbArticlesStore,
  ticketComments: ticketCommentsStore,
  ticketTags: ticketTagsStore,
  ticketTagLinks: ticketTagLinksStore,
  ticketAssignmentRules: ticketAssignmentRulesStore,
  ticketAssignmentRuleEntries: ticketAssignmentRuleEntriesStore,
  ticketEscalationRules: ticketEscalationRulesStore,
  ticketEscalations: ticketEscalationsStore,
  ticketMacros: ticketMacrosStore,
  schemaMigrations: schemaMigrationsStore,
  scheduledReports: scheduledReportsStore,
  scheduledReportRuns: scheduledReportRunsStore,
  picklistDependencies: picklistDependenciesStore,
  validationRules: validationRulesStore,
  emailTemplates: emailTemplatesStore,
  emailTrackers: emailTrackersStore,
  marketingSegments: marketingSegmentsStore,
  marketingSequences: marketingSequencesStore,
  marketingSequenceSteps: marketingSequenceStepsStore,
  marketingSequenceMemberships: marketingSequenceMembershipsStore,
  marketingSequenceExitTriggers: marketingSequenceExitTriggersStore,
  marketingSequenceScoreTriggers: marketingSequenceScoreTriggersStore,
  marketingSequenceGlobalVariables: marketingSequenceGlobalVariablesStore,
  marketingSequenceFolders: marketingSequenceFoldersStore,
  marketingSequenceTags: marketingSequenceTagsStore,
  marketingSequenceTagMappings: marketingSequenceTagMappingsStore,
  marketingSequenceStepSplitTests: marketingSequenceStepSplitTestsStore,
  marketingSequenceStepBranches: marketingSequenceStepBranchesStore,
  marketingSequenceGoals: marketingSequenceGoalsStore,
  marketingSequenceConversions: marketingSequenceConversionsStore,
  marketingSequenceSuppressions: marketingSequenceSuppressionsStore,
  marketingSequenceExclusions: marketingSequenceExclusionsStore,
  marketingSequenceAbAllocations: marketingSequenceAbAllocationsStore,
  marketingSequenceCaps: marketingSequenceCapsStore,
  marketingSequenceLinkActions: marketingSequenceLinkActionsStore,
  marketingSequenceOpenActions: marketingSequenceOpenActionsStore,
  marketingSequenceReplyActions: marketingSequenceReplyActionsStore,
  emailClickEvents: emailClickEventsStore,
  emailUnsubscribes: emailUnsubscribesStore,
  emailOpenEvents: emailOpenEventsStore,
  emailReplyEvents: emailReplyEventsStore,
  emailBounceEvents: emailBounceEventsStore,
  emailReadTimeEvents: emailReadTimeEventsStore,
};

const pgStores: Record<string, any> = {};

export const stores = new Proxy(mockStores, {
  get(target, prop: string) {
    if (prop === "clear") {
      return async () => {
        if (process.env.DB_DRIVER === "pg") {
          await clearPgDb(getDb());
        }
      };
    }
    if (process.env.DB_DRIVER === "pg") {
      if (!pgStores[prop]) {
        const meta = storeMetadata[prop];
        if (meta) {
          pgStores[prop] = createPgStore(prop, meta.table, meta.prefix, getDb);
        } else {
          pgStores[prop] = target[prop as keyof typeof target];
        }
      }
      return pgStores[prop];
    }
    return target[prop as keyof typeof target];
  },
}) as typeof mockStores & { clear: () => Promise<void> };
