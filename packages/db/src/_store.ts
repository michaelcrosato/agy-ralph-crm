export { genId } from "./_ids";
export { assertTenantOwns } from "./_rls";
export type { MockDatabase } from "./_tenant";
export {
  assertSessionTenant,
  getActiveOrgId,
  mockDb,
  tenantStorage,
  withTenant,
} from "./_tenant";
export * from "./schema";

export const DB_VERSION = "0.1.0";

export interface DBUser {
  id: string;
  email: string;
  passwordHash: string;
  status: string;
  createdAt: Date;
}

export interface DBMembership {
  id: string;
  orgId: string;
  userId: string;
  roleId: string;
}

export interface DBLead {
  id: string;
  orgId: string;
  ownerId: string;
  status: string;
  email: string | null;
  company: string | null;
  convertedAccountId: string | null;
  convertedContactId: string | null;
  custom: Record<string, unknown> | null;
}

export interface DBAccount {
  id: string;
  orgId: string;
  ownerId: string;
  name: string;
  domain: string | null;
  custom: Record<string, unknown> | null;
  parentAccountId?: string | null;
}

export interface DBContact {
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

export interface DBOpportunity {
  id: string;
  orgId: string;
  ownerId: string;
  accountId: string | null;
  campaignId?: string | null;
  name: string;
  stage: string;
  amount: string | null;
  closeDate: Date | null;
  custom: Record<string, unknown> | null;
  currencyCode?: string;
  amountCorporate?: string | null;
}

export interface DBFieldDefinition {
  id: string;
  orgId: string;
  objectType: string;
  apiName: string;
  label: string;
  dataType: "text" | "number" | "boolean" | "picklist";
  validationRules: {
    min?: number;
    max?: number;
    options?: string[];
  } | null;
}

export interface DBLayoutDefinition {
  id: string;
  orgId: string;
  objectType: string;
  sections: {
    title: string;
    fields: string[];
  }[];
}

export interface DBAuditLog {
  id: string;
  orgId: string;
  recordId: string;
  recordType: string;
  action: string;
  userId: string;
  changes: Record<string, { before: unknown; after: unknown }> | null;
  seq?: number | null;
  prevHash?: string | null;
  hash?: string | null;
  createdAt: Date;
}

export interface DBWorkflow {
  id: string;
  orgId: string;
  name: string;
  triggerEvent: string;
  conditions: {
    field: string;
    operator: "equals" | "not_equals";
    value: string;
  } | null;
  actions: {
    type: "webhook" | "notification";
    target: string;
  }[];
}

export interface DBTicket {
  id: string;
  orgId: string;
  contactId: string;
  subject: string;
  status: "Open" | "In Progress" | "Resolved";
  priority?: string;
  assignedToId?: string | null;
  createdAt: Date;
}

export interface DBTicketEscalationRule {
  id: string;
  orgId: string;
  name: string;
  triggerType: "milestone_approaching" | "milestone_breached";
  timeThresholdMinutes: number;
  escalateToId: string;
  newPriority: string | null;
  isActive: number;
  createdAt: Date;
}

export interface DBTicketEscalation {
  id: string;
  orgId: string;
  ticketId: string;
  ruleId: string | null;
  previousAssignedToId: string | null;
  escalatedToId: string;
  previousPriority: string | null;
  newPriority: string | null;
  reason: string;
  createdAt: Date;
}

export interface DBTicketMacro {
  id: string;
  orgId: string;
  name: string;
  description: string | null;
  cannedResponse: string;
  updateStatus: string | null;
  updatePriority: string | null;
  createdAt: Date;
}

export interface DBSchemaMigration {
  id: string;
  orgId: string;
  version: number;
  name: string;
  appliedAt: Date;
}

export interface DBTicketAssignmentRule {
  id: string;
  orgId: string;
  name: string;
  isActive: number;
  createdAt: Date;
}

export interface DBTicketAssignmentRuleEntry {
  id: string;
  orgId: string;
  ruleId: string;
  sortOrder: number;
  routingMethod: string; // "direct" | "round_robin"
  routingUserIds: string[];
  lastAssignedIndex: number;
  criteria: DBCriteriaCondition[];
}

export interface DBActivity {
  id: string;
  orgId: string;
  creatorId: string;
  type: "task" | "call" | "note" | "email" | "sms";
  subject: string;
  body: string | null;
  dueDate: Date | null;
  createdAt: Date;
  custom?: Record<string, unknown> | null;
}

export interface DBActivityLink {
  id: string;
  orgId: string;
  activityId: string;
  targetType: "Account" | "Contact" | "Lead" | "Opportunity" | "Campaign";
  targetId: string;
}

export interface DBReport {
  id: string;
  orgId: string;
  name: string;
  objectType: "leads" | "opportunities" | "tickets" | "accounts" | "contacts";
  groupBy: string;
  aggregateField: string | null;
  aggregateFunc: "count" | "sum" | "avg";
  createdAt: Date;
}

export interface DBProduct {
  id: string;
  orgId: string;
  name: string;
  sku: string | null;
  description: string | null;
  isActive: boolean;
}

export interface DBPricebook {
  id: string;
  orgId: string;
  name: string;
  description: string | null;
  isActive: boolean;
  isStandard: boolean;
}

export interface DBPricebookEntry {
  id: string;
  orgId: string;
  pricebookId: string;
  productId: string;
  unitPrice: string;
  isActive: boolean;
}

export interface DBOpportunityProduct {
  id: string;
  orgId: string;
  opportunityId: string;
  pricebookEntryId: string;
  quantity: number;
  unitPrice: string;
  totalPrice: string;
}

export interface DBQuota {
  id: string;
  orgId: string;
  userId: string;
  period: string;
  targetAmount: string;
}

export interface DBStageProbability {
  id: string;
  orgId: string;
  stage: string;
  probability: number;
}

export interface DBWebhook {
  id: string;
  orgId: string;
  targetUrl: string;
  secret: string | null;
  status: string;
}

export interface DBWebhookDelivery {
  id: string;
  orgId: string;
  webhookId: string;
  event: string;
  statusCode: number;
  payload: string;
  createdAt: Date;
}

export interface DBDocumentTemplate {
  id: string;
  orgId: string;
  name: string;
  content: string;
  createdAt: Date;
}

export interface DBMergedDocument {
  id: string;
  orgId: string;
  templateId: string;
  recordType: string;
  recordId: string;
  compiledContent: string;
  createdAt: Date;
}

export interface DBSubscription {
  id: string;
  orgId: string;
  accountId: string;
  planName: string;
  status: string;
  billingPeriod: string;
  unitPrice: string;
  quantity: number;
  startDate: Date;
  endDate: Date | null;
}

export interface DBInvoice {
  id: string;
  orgId: string;
  subscriptionId: string;
  accountId: string;
  amount: string;
  dueDate: Date;
  status: string;
}

export interface DBWebhookOutbox {
  id: string;
  orgId: string;
  webhookId: string;
  event: string;
  payload: string;
  status: string;
  attempts: number;
  lastAttemptAt: Date | null;
  nextAttemptAt: Date;
  createdAt: Date;
  lastError: string | null;
}

export interface DBWebhookDlq {
  id: string;
  orgId: string;
  webhookId: string;
  event: string;
  payload: string;
  failedAt: Date;
  attempts: number;
  lastError: string | null;
}

export interface DBOpportunityApproval {
  id: string;
  orgId: string;
  opportunityId: string;
  submitterId: string;
  status: string;
  createdAt: Date;
}

export interface DBOpportunityApprovalStep {
  id: string;
  orgId: string;
  approvalId: string;
  stepName: string;
  approverRoleId: string;
  status: string;
  decidedByUserId: string | null;
  comments: string | null;
  decidedAt: Date | null;
}

export interface DBCommission {
  id: string;
  orgId: string;
  userId: string;
  opportunityId: string;
  amount: string;
  rateApplied: string;
  status: "Pending" | "Approved" | "Paid";
  createdAt: Date;
}

export interface DBCriteriaCondition {
  field: string;
  operator: "equals" | "contains" | "greater_than" | "less_than";
  value: string;
}

export interface DBLeadAssignmentRule {
  id: string;
  orgId: string;
  name: string;
  isActive: number; // 0 or 1
  createdAt: Date;
}

export interface DBLeadAssignmentRuleEntry {
  id: string;
  orgId: string;
  ruleId: string;
  sortOrder: number;
  routingMethod: string; // "direct" | "round_robin"
  routingUserIds: string[];
  lastAssignedIndex: number;
  criteria: DBCriteriaCondition[];
}

export interface DBTerritory {
  id: string;
  orgId: string;
  name: string;
  isActive: number; // 0 or 1
  routingMethod: string; // "direct" | "round_robin"
  lastAssignedIndex: number;
  criteria: DBCriteriaCondition[];
  createdAt: Date;
}

export interface DBTerritoryMember {
  id: string;
  orgId: string;
  territoryId: string;
  userId: string;
  role: string; // "Primary" | "Overlay"
}

export interface DBOpportunitySplit {
  id: string;
  orgId: string;
  opportunityId: string;
  userId: string;
  percentage: number;
  splitAmount: string;
  createdAt?: Date;
}

export interface DBCampaign {
  id: string;
  orgId: string;
  name: string;
  status: string;
  type: string;
  isActive: number;
  startDate: Date | null;
  endDate: Date | null;
  budgetedCost: string;
  actualCost: string;
  expectedRevenue: string;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  createdAt: Date;
}

export interface DBCampaignMember {
  id: string;
  orgId: string;
  campaignId: string;
  leadId: string | null;
  contactId: string | null;
  status: string;
  createdAt: Date;
}

export interface DBOpportunityStageHistory {
  id: string;
  orgId: string;
  opportunityId: string;
  fromStage: string | null;
  toStage: string;
  amount: string | null;
  changedById: string;
  createdAt: Date;
}

export interface DBOpportunityContactRole {
  id: string;
  orgId: string;
  opportunityId: string;
  contactId: string;
  role: string;
  isPrimary: boolean;
  createdAt: Date;
}

export interface DBCampaignInfluence {
  id: string;
  orgId: string;
  opportunityId: string;
  campaignId: string;
  influencePercentage: number;
  revenueShare: string;
  createdAt: Date;
}

export interface DBMarketingSegment {
  id: string;
  orgId: string;
  name: string;
  description: string;
  objectType: "lead" | "contact";
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
  createdAt: Date;
  updatedAt: Date;
}

export interface DBMarketingSequence {
  id: string;
  orgId: string;
  name: string;
  description: string;
  status: string; // "active" | "draft"
  sendingWindowStart?: string | null;
  sendingWindowEnd?: string | null;
  sendingDays?: number[] | null;
  allowReenrollment?: boolean | null;
  reenrollmentMinDays?: number | null;
  dailySendLimit?: number | null;
  senderType: string;
  senderUserId?: string | null;
  folderId?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface DBMarketingSequenceStep {
  id: string;
  orgId: string;
  sequenceId: string;
  stepNumber: number;
  delayDays: number;
  templateId: string | null;
  waitCondition?: {
    waitType: "day_of_week" | "duration";
    daysOfWeek?: number[];
    timeOfDay?: string;
  } | null;
  replyToStepNumber?: number | null;
  stepType: "email" | "webhook" | "task" | "sms" | "call";
  webhookUrl?: string | null;
  webhookPayload?: string | null;
  taskSubject?: string | null;
  taskBody?: string | null;
  taskDueDays?: number | null;
  smsMessage?: string | null;
  callScript?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface DBMarketingSequenceMembership {
  id: string;
  orgId: string;
  sequenceId: string;
  recordType: "lead" | "contact";
  recordId: string;
  status: string; // "active" | "completed" | "unsubscribed" | "error"
  currentStepNumber: number;
  engagementScore?: number;
  lastExecutedAt: Date | null;
  nextExecutionAt: Date;
  snoozeUntil: Date | null;
  snoozeReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface DBMarketingSequenceExitTrigger {
  id: string;
  orgId: string;
  sequenceId: string;
  triggerType: string;
  criteria: Record<string, unknown>;
  isActive: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface DBMarketingSequenceScoreTrigger {
  id: string;
  orgId: string;
  sequenceId: string;
  scoreThreshold: number;
  actionType: "change_lead_status" | "auto_exit" | "notify_owner";
  actionConfig: {
    status?: string;
    subject?: string;
    body?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface DBMarketingSequenceGlobalVariable {
  id: string;
  orgId: string;
  key: string;
  value: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface DBMarketingSequenceFolder {
  id: string;
  orgId: string;
  name: string;
  parentFolderId: string | null;
  createdAt: Date;
}

export interface DBMarketingSequenceTag {
  id: string;
  orgId: string;
  name: string;
  color: string;
  createdAt: Date;
}

export interface DBMarketingSequenceTagMapping {
  id: string;
  orgId: string;
  sequenceId: string;
  tagId: string;
}

export interface DBMarketingSequenceStepSplitTest {
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

export interface DBMarketingSequenceStepBranch {
  id: string;
  orgId: string;
  stepId: string;
  branchType: string; // "email_open" | "email_click"
  evaluationWindowDays: number;
  trueNextStepNumber: number;
  falseNextStepNumber: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface DBMarketingSequenceAbAllocation {
  id: string;
  orgId: string;
  membershipId: string;
  stepId: string;
  allocatedTemplateId: string;
  createdAt: Date;
}

export interface DBMarketingSequenceGoal {
  id: string;
  orgId: string;
  sequenceId: string;
  goalType: string; // "lead_status_equals" | "opportunity_created"
  targetValue: string | null;
  isActive: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface DBMarketingSequenceConversion {
  id: string;
  orgId: string;
  membershipId: string;
  sequenceId: string;
  goalId: string;
  attributedRevenue: string;
  convertedAt: Date;
  createdAt: Date;
}

export interface DBMarketingSequenceSuppression {
  id: string;
  orgId: string;
  recordType: string;
  recordId: string | null;
  pattern: string | null;
  reason: string;
  createdAt: Date;
}

export interface DBMarketingSequenceExclusion {
  id: string;
  orgId: string;
  sequenceId: string;
  exclusionType: string;
  exclusionValue: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface DBMarketingSequenceLinkAction {
  id: string;
  orgId: string;
  stepId: string;
  targetUrl: string;
  actionType: string;
  actionConfig: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface DBMarketingSequenceOpenAction {
  id: string;
  orgId: string;
  stepId: string;
  actionType: string;
  actionConfig: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface DBMarketingSequenceReplyAction {
  id: string;
  orgId: string;
  stepId: string;
  actionType: string;
  actionConfig: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface DBMarketingSequenceCap {
  id: string;
  orgId: string;
  domainThrottleLimit: number;
  recipientFrequencyCap: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface DBContract {
  id: string;
  orgId: string;
  accountId: string;
  opportunityId: string | null;
  contractAmount: string;
  startDate: Date;
  endDate: Date;
  status: "Draft" | "Active" | "Expired" | "Renewed";
  createdAt: Date;
}

export interface DBLeadSlaTarget {
  id: string;
  orgId: string;
  maxResponseTimeMinutes: number;
  isActive: number;
  createdAt: Date;
}

export interface DBLeadSlaTracker {
  id: string;
  orgId: string;
  leadId: string;
  targetId: string;
  status: string; // "Pending" | "Met" | "Breached"
  createdAt: Date;
  respondedAt: Date | null;
  responseTimeMinutes: number | null;
}

export interface DBAccountTeamMember {
  id: string;
  orgId: string;
  accountId: string;
  userId: string;
  role: string;
  createdAt: Date;
}

export interface DBOpportunityTeamMember {
  id: string;
  orgId: string;
  opportunityId: string;
  userId: string;
  role: string;
  createdAt: Date;
}

export interface DBOpportunityProductSchedule {
  id: string;
  orgId: string;
  opportunityProductId: string;
  scheduleType: "revenue" | "quantity";
  scheduleDate: Date;
  amount: string;
  description: string | null;
  createdAt: Date;
}

export interface DBLeadScoringRule {
  id: string;
  orgId: string;
  name: string;
  criteria: DBCriteriaCondition[];
  scoreValue: number;
  isActive: number;
  createdAt: Date;
}

export interface DBOpportunityCompetitor {
  id: string;
  orgId: string;
  opportunityId: string;
  name: string;
  strength: string | null;
  weakness: string | null;
  winLossStatus: string;
  notes: string | null;
  createdAt: Date;
}

export interface DBLeadConversionMapping {
  id: string;
  orgId: string;
  sourceLeadField: string;
  targetObjectType: "accounts" | "contacts" | "opportunities";
  targetField: string;
  createdAt: Date;
}

export interface DBCurrency {
  id: string;
  orgId: string;
  isoCode: string;
  displayName: string;
  symbol: string;
  exchangeRate: string;
  isCorporate: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface DBOpportunityStageGate {
  id: string;
  orgId: string;
  targetStage: string;
  field: string;
  operator: string;
  expectedValue: string | null;
  errorMessage: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface DBStageGuidance {
  id: string;
  orgId: string;
  objectType: string;
  stage: string;
  keyFields: string[];
  guidanceText: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface DBLeadAutoConversionRule {
  id: string;
  orgId: string;
  name: string;
  isActive: number;
  createOpportunity: number;
  opportunityStage: string;
  criteria: {
    field: string;
    operator: "equals" | "greater_or_equal" | "less_or_equal";
    value: string | number;
  };
  createdAt: Date;
}

export interface DBOpportunityStageDurationRule {
  id: string;
  orgId: string;
  stage: string;
  maxDaysAllowed: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface DBContactConsentPreference {
  id: string;
  orgId: string;
  recordType: "lead" | "contact";
  recordId: string;
  channel: "email" | "sms" | "phone";
  status: "opt_in" | "opt_out" | "pending";
  source: string;
  updatedById: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface DBEmailCalendarSyncSettings {
  id: string;
  orgId: string;
  userId: string;
  provider: string;
  isActive: boolean;
  syncEmails: boolean;
  syncCalendar: boolean;
  lastSyncedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface DBEmailCalendarSyncRun {
  id: string;
  orgId: string;
  settingsId: string;
  status: "success" | "failed";
  emailsSyncedCount: number;
  eventsSyncedCount: number;
  errorMessage: string | null;
  startedAt: Date;
  completedAt: Date;
}

export interface DBEsignatureRequest {
  id: string;
  orgId: string;
  documentName: string;
  signerEmail: string;
  status: "sent" | "viewed" | "signed" | "declined";
  opportunityId: string | null;
  contractId: string | null;
  sentAt: Date;
  completedAt: Date | null;
}

export interface DBSurvey {
  id: string;
  orgId: string;
  name: string;
  type: "csat" | "nps";
  status: "draft" | "active" | "closed";
  createdAt: Date;
}

export interface DBSurveyResponse {
  id: string;
  orgId: string;
  surveyId: string;
  contactId: string | null;
  ticketId?: string | null;
  score: number;
  comment: string | null;
  createdAt: Date;
}

export interface DBSlaPolicy {
  id: string;
  orgId: string;
  name: string;
  priority: "high" | "medium" | "low";
  responseTimeLimitMinutes: number;
  resolutionTimeLimitMinutes: number;
  isActive: boolean;
  createdAt: Date;
}

export interface DBTicketMilestone {
  id: string;
  orgId: string;
  ticketId: string;
  milestoneType: "first_response" | "resolution";
  targetTime: Date;
  completedAt: Date | null;
  status: "pending" | "completed" | "breached";
  isMet: boolean | null;
  createdAt: Date;
}

export interface DBKbCategory {
  id: string;
  orgId: string;
  name: string;
  description: string | null;
  createdAt: Date;
}

export interface DBKbArticle {
  id: string;
  orgId: string;
  categoryId: string;
  title: string;
  content: string;
  status: "Draft" | "Published";
  viewCount: number;
  authorId: string;
  createdAt: Date;
}

export interface DBTicketComment {
  id: string;
  orgId: string;
  ticketId: string;
  authorId: string;
  body: string;
  createdAt: Date;
}

export interface DBTicketTag {
  id: string;
  orgId: string;
  name: string;
  color: string;
  createdAt: Date;
}

export interface DBTicketTagLink {
  id: string;
  orgId: string;
  ticketId: string;
  tagId: string;
  createdAt: Date;
}

export interface DBScheduledReport {
  id: string;
  orgId: string;
  reportId: string;
  recipientEmail: string;
  frequency: "daily" | "weekly" | "monthly";
  nextRunAt: Date;
  isActive: number;
  createdAt: Date;
}

export interface DBScheduledReportRun {
  id: string;
  orgId: string;
  scheduledReportId: string;
  status: "success" | "failed";
  errorMessage: string | null;
  runAt: Date;
}

export interface DBStageForecastMapping {
  id: string;
  orgId: string;
  stage: string;
  forecastCategory: string; // "Omitted" | "Pipeline" | "Best Case" | "Commit" | "Closed"
}

export interface DBPicklistDependency {
  id: string;
  orgId: string;
  objectType: string;
  parentField: string;
  dependentField: string;
  dependencyMap: Record<string, string[]>;
  createdAt: Date;
  updatedAt: Date;
}

export interface DBValidationRule {
  id: string;
  orgId: string;
  name: string;
  description: string | null;
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
  createdAt: Date;
  updatedAt: Date;
}

export interface DBEmailTemplate {
  id: string;
  orgId: string;
  name: string;
  subject: string;
  body: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface DBEmailTracker {
  id: string;
  orgId: string;
  activityId: string;
  token: string;
  openCount: number;
  clickCount: number;
  replyCount: number;
  bounceCount: number;
  lastOpenedAt: Date | null;
  lastClickedAt: Date | null;
  lastRepliedAt: Date | null;
  lastBouncedAt: Date | null;
  totalReadTimeMs: number;
  lastReadClassification: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface DBEmailClickEvent {
  id: string;
  orgId: string;
  trackerId: string;
  clickedUrl: string;
  ipAddress: string;
  userAgent: string;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmTerm: string | null;
  utmContent: string | null;
  createdAt: Date;
}

export interface DBEmailUnsubscribe {
  id: string;
  orgId: string;
  trackerId: string;
  reason: string;
  feedback: string | null;
  createdAt: Date;
}

export interface DBEmailOpenEvent {
  id: string;
  orgId: string;
  trackerId: string;
  ipAddress: string;
  userAgent: string;
  deviceType: string;
  createdAt: Date;
}

export interface DBEmailReplyEvent {
  id: string;
  orgId: string;
  trackerId: string;
  replyBody: string | null;
  senderEmail: string;
  sentiment: string;
  createdAt: Date;
}

export interface DBEmailBounceEvent {
  id: string;
  orgId: string;
  trackerId: string;
  eventType: string; // 'bounce' | 'complaint'
  bounceType: string; // 'hard' | 'soft' | 'spam_complaint'
  bounceReason: string | null;
  createdAt: Date;
}

export interface DBEmailReadTimeEvent {
  id: string;
  orgId: string;
  trackerId: string;
  durationMs: number;
  readClassification: string; // 'glanced' | 'skimmed' | 'read'
  createdAt: Date;
}

export interface DBForecastAdjustment {
  id: string;
  orgId: string;
  userId: string;
  adjustedByUserId: string;
  period: string;
  amount: string;
  adjustmentType: string;
  comments: string | null;
  createdAt: Date;
}

export interface DBCustomEntityType {
  id: string;
  orgId: string;
  name: string;
  fieldsJson: any; // list of CustomFieldSpec
}

export interface DBCustomEntityRecord {
  id: string;
  orgId: string;
  typeId: string;
  data: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface DBEmbedding {
  id: string;
  orgId: string;
  entityType: string;
  entityId: string;
  embedding: number[];
  createdAt: Date;
}

export const store = {
  customEntityTypes: [] as DBCustomEntityType[],
  customEntityRecords: [] as DBCustomEntityRecord[],
  embeddings: [] as DBEmbedding[],
  emailTemplates: [] as DBEmailTemplate[],
  emailTrackers: [] as DBEmailTracker[],
  picklistDependencies: [] as DBPicklistDependency[],
  validationRules: [] as DBValidationRule[],
  stageForecastMappings: [] as DBStageForecastMapping[],
  forecastAdjustments: [] as DBForecastAdjustment[],
  users: [] as DBUser[],
  memberships: [] as DBMembership[],
  leads: [] as DBLead[],
  accounts: [] as DBAccount[],
  contacts: [] as DBContact[],
  opportunities: [] as DBOpportunity[],
  auditLogs: [] as DBAuditLog[],
  fieldDefinitions: [] as DBFieldDefinition[],
  layoutDefinitions: [] as DBLayoutDefinition[],
  workflows: [] as DBWorkflow[],
  tickets: [] as DBTicket[],
  activities: [] as DBActivity[],
  activityLinks: [] as DBActivityLink[],
  reports: [] as DBReport[],
  products: [] as DBProduct[],
  pricebooks: [] as DBPricebook[],
  pricebookEntries: [] as DBPricebookEntry[],
  opportunityProducts: [] as DBOpportunityProduct[],
  quotas: [] as DBQuota[],
  stageProbabilities: [] as DBStageProbability[],
  webhooks: [] as DBWebhook[],
  webhookDeliveries: [] as DBWebhookDelivery[],
  documentTemplates: [] as DBDocumentTemplate[],
  mergedDocuments: [] as DBMergedDocument[],
  subscriptions: [] as DBSubscription[],
  invoices: [] as DBInvoice[],
  webhookOutbox: [] as DBWebhookOutbox[],
  webhookDlq: [] as DBWebhookDlq[],
  opportunityApprovals: [] as DBOpportunityApproval[],
  opportunityApprovalSteps: [] as DBOpportunityApprovalStep[],
  commissions: [] as DBCommission[],
  leadAssignmentRules: [] as DBLeadAssignmentRule[],
  leadAssignmentRuleEntries: [] as DBLeadAssignmentRuleEntry[],
  territories: [] as DBTerritory[],
  territoryMembers: [] as DBTerritoryMember[],
  opportunitySplits: [] as DBOpportunitySplit[],
  campaigns: [] as DBCampaign[],
  campaignMembers: [] as DBCampaignMember[],
  opportunityStageHistory: [] as DBOpportunityStageHistory[],
  opportunityContactRoles: [] as DBOpportunityContactRole[],
  campaignInfluence: [] as DBCampaignInfluence[],
  marketingSegments: [] as DBMarketingSegment[],
  marketingSequences: [] as DBMarketingSequence[],
  marketingSequenceSteps: [] as DBMarketingSequenceStep[],
  marketingSequenceMemberships: [] as DBMarketingSequenceMembership[],
  marketingSequenceExitTriggers: [] as DBMarketingSequenceExitTrigger[],
  marketingSequenceStepSplitTests: [] as DBMarketingSequenceStepSplitTest[],
  marketingSequenceStepBranches: [] as DBMarketingSequenceStepBranch[],
  marketingSequenceGoals: [] as DBMarketingSequenceGoal[],
  marketingSequenceConversions: [] as DBMarketingSequenceConversion[],
  marketingSequenceSuppressions: [] as DBMarketingSequenceSuppression[],
  marketingSequenceExclusions: [] as DBMarketingSequenceExclusion[],
  marketingSequenceScoreTriggers: [] as DBMarketingSequenceScoreTrigger[],
  marketingSequenceGlobalVariables: [] as DBMarketingSequenceGlobalVariable[],
  marketingSequenceFolders: [] as DBMarketingSequenceFolder[],
  marketingSequenceTags: [] as DBMarketingSequenceTag[],
  marketingSequenceTagMappings: [] as DBMarketingSequenceTagMapping[],
  marketingSequenceAbAllocations: [] as DBMarketingSequenceAbAllocation[],

  marketingSequenceCaps: [] as DBMarketingSequenceCap[],
  marketingSequenceLinkActions: [] as DBMarketingSequenceLinkAction[],
  marketingSequenceOpenActions: [] as DBMarketingSequenceOpenAction[],
  marketingSequenceReplyActions: [] as DBMarketingSequenceReplyAction[],
  emailClickEvents: [] as DBEmailClickEvent[],
  emailUnsubscribes: [] as DBEmailUnsubscribe[],
  emailOpenEvents: [] as DBEmailOpenEvent[],
  emailReplyEvents: [] as DBEmailReplyEvent[],
  emailBounceEvents: [] as DBEmailBounceEvent[],
  emailReadTimeEvents: [] as DBEmailReadTimeEvent[],

  contracts: [] as DBContract[],
  leadSlaTargets: [] as DBLeadSlaTarget[],
  leadSlaTrackers: [] as DBLeadSlaTracker[],
  accountTeams: [] as DBAccountTeamMember[],
  opportunityTeams: [] as DBOpportunityTeamMember[],
  opportunityProductSchedules: [] as DBOpportunityProductSchedule[],
  leadScoringRules: [] as DBLeadScoringRule[],
  opportunityCompetitors: [] as DBOpportunityCompetitor[],
  leadConversionMappings: [] as DBLeadConversionMapping[],
  currencies: [] as DBCurrency[],
  opportunityStageGates: [] as DBOpportunityStageGate[],
  stageGuidance: [] as DBStageGuidance[],
  leadAutoConversionRules: [] as DBLeadAutoConversionRule[],
  opportunityStageDurationRules: [] as DBOpportunityStageDurationRule[],
  contactConsentPreferences: [] as DBContactConsentPreference[],
  emailCalendarSyncSettings: [] as DBEmailCalendarSyncSettings[],
  emailCalendarSyncRuns: [] as DBEmailCalendarSyncRun[],
  esignatureRequests: [] as DBEsignatureRequest[],
  surveys: [] as DBSurvey[],
  surveyResponses: [] as DBSurveyResponse[],
  slaPolicies: [] as DBSlaPolicy[],
  ticketMilestones: [] as DBTicketMilestone[],
  kbCategories: [] as DBKbCategory[],
  kbArticles: [] as DBKbArticle[],
  ticketComments: [] as DBTicketComment[],
  ticketTags: [] as DBTicketTag[],
  ticketTagLinks: [] as DBTicketTagLink[],
  ticketAssignmentRules: [] as DBTicketAssignmentRule[],
  ticketAssignmentRuleEntries: [] as DBTicketAssignmentRuleEntry[],
  ticketEscalationRules: [] as DBTicketEscalationRule[],
  ticketEscalations: [] as DBTicketEscalation[],
  ticketMacros: [] as DBTicketMacro[],
  schemaMigrations: [] as DBSchemaMigration[],
  scheduledReports: [] as DBScheduledReport[],
  scheduledReportRuns: [] as DBScheduledReportRun[],
};
