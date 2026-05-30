import { store } from "./_store";
import { stores } from "./stores";

export { genId } from "./_ids";
export { assertTenantOwns } from "./_rls";
export * from "./_store";
export {
  assertSessionTenant,
  getActiveOrgId,
  mockDb,
  tenantStorage,
  withTenant,
} from "./_tenant";
export * from "./schema";

export const dbStore = {
  ...stores,
  clear: () => {
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
  },
};
