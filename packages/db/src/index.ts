import { AsyncLocalStorage } from "node:async_hooks";
import { sql } from "drizzle-orm";
import { integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export * from "./schema";

export const DB_VERSION = "0.1.0";

// Mock pgDatabase connection interface for RLS
export interface MockDatabase {
  execute: (query: unknown) => Promise<unknown>;
  transaction: <T>(run: (tx: MockDatabase) => Promise<T>) => Promise<T>;
}

// In-memory or dummy DB connection for testing and local verification
export const mockDb: MockDatabase = {
  execute: async (query) => {
    return { rows: [] };
  },
  transaction: async (run) => {
    return await run(mockDb);
  },
};

export const tenantStorage = new AsyncLocalStorage<{ orgId: string }>();

// withTenant executes a callback in a database transaction with app.current_org_id set for RLS isolation
export async function withTenant<T>(
  orgId: string,
  db: MockDatabase,
  run: (tx: MockDatabase) => Promise<T>,
): Promise<T> {
  return await tenantStorage.run({ orgId }, async () => {
    return await db.transaction(async (tx) => {
      // Set the PostgreSQL local transaction variable
      await tx.execute(sql`SET LOCAL app.current_org_id = ${orgId}`);
      return await run(tx);
    });
  });
}

// Get active tenant context, throwing if RLS is bypassed
export function getActiveOrgId(): string {
  const context = tenantStorage.getStore();
  if (!context?.orgId) {
    throw new Error("RLS Isolation Violation: Tenant context not set.");
  }
  return context.orgId;
}

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
  type: "task" | "call" | "note" | "email";
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
  stepType: "email" | "webhook";
  webhookUrl?: string | null;
  webhookPayload?: string | null;
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

export const store = {
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

export const dbStore = {
  users: {
    findMany: async () => {
      return store.users;
    },
    findOne: async (id: string) => {
      return store.users.find((u) => u.id === id) || null;
    },
    insert: async (
      user: Omit<DBUser, "id" | "createdAt"> & { id?: string },
    ) => {
      const newUser: DBUser = {
        ...user,
        id: user.id || `user-${Math.random().toString(36).substring(2, 11)}`,
        createdAt: new Date(),
      };
      store.users.push(newUser);
      return newUser;
    },
  },
  memberships: {
    findMany: async () => {
      const orgId = getActiveOrgId();
      return store.memberships.filter((m) => m.orgId === orgId);
    },
    insert: async (membership: Omit<DBMembership, "id">) => {
      const orgId = getActiveOrgId();
      if (membership.orgId !== orgId) {
        throw new Error("RLS Isolation Violation: Tenant mismatch.");
      }
      const newMembership: DBMembership = {
        ...membership,
        id: `membership-${Math.random().toString(36).substring(2, 11)}`,
      };
      store.memberships.push(newMembership);
      return newMembership;
    },
  },
  leads: {
    findMany: async () => {
      const orgId = getActiveOrgId();
      return store.leads.filter((lead) => lead.orgId === orgId);
    },
    findOne: async (id: string) => {
      const orgId = getActiveOrgId();
      const lead = store.leads.find((l) => l.id === id);
      if (lead && lead.orgId !== orgId) {
        return null;
      }
      return lead || null;
    },
    insert: async (lead: Omit<DBLead, "id">) => {
      const orgId = getActiveOrgId();
      if (lead.orgId !== orgId) {
        throw new Error("RLS Isolation Violation: Tenant mismatch.");
      }
      const newLead: DBLead = {
        ...lead,
        id: `lead-${Math.random().toString(36).substring(2, 11)}`,
      };
      store.leads.push(newLead);
      return newLead;
    },
    update: async (
      id: string,
      updates: Partial<Omit<DBLead, "id" | "orgId">>,
    ) => {
      const orgId = getActiveOrgId();
      const index = store.leads.findIndex((l) => l.id === id);
      if (index === -1) return null;
      if (store.leads[index].orgId !== orgId) {
        throw new Error("RLS Isolation Violation: Tenant mismatch.");
      }
      store.leads[index] = { ...store.leads[index], ...updates };
      return store.leads[index];
    },
    delete: async (id: string) => {
      const orgId = getActiveOrgId();
      const index = store.leads.findIndex((l) => l.id === id);
      if (index === -1) return false;
      if (store.leads[index].orgId !== orgId) {
        throw new Error("RLS Isolation Violation: Tenant mismatch.");
      }
      store.leads.splice(index, 1);
      return true;
    },
  },
  accounts: {
    findMany: async () => {
      const orgId = getActiveOrgId();
      return store.accounts.filter((acc) => acc.orgId === orgId);
    },
    findOne: async (id: string) => {
      const orgId = getActiveOrgId();
      const acc = store.accounts.find((a) => a.id === id);
      if (acc && acc.orgId !== orgId) {
        return null;
      }
      return acc || null;
    },
    insert: async (acc: Omit<DBAccount, "id">) => {
      const orgId = getActiveOrgId();
      if (acc.orgId !== orgId) {
        throw new Error("RLS Isolation Violation: Tenant mismatch.");
      }
      const newAcc: DBAccount = {
        ...acc,
        parentAccountId: acc.parentAccountId || null,
        id: `account-${Math.random().toString(36).substring(2, 11)}`,
      };
      store.accounts.push(newAcc);
      return newAcc;
    },
    update: async (
      id: string,
      updates: Partial<Omit<DBAccount, "id" | "orgId">>,
    ) => {
      const orgId = getActiveOrgId();
      const index = store.accounts.findIndex((a) => a.id === id);
      if (index === -1) return null;
      if (store.accounts[index].orgId !== orgId) {
        throw new Error("RLS Isolation Violation: Tenant mismatch.");
      }
      store.accounts[index] = { ...store.accounts[index], ...updates };
      return store.accounts[index];
    },
    findChildren: async (parentId: string) => {
      const orgId = getActiveOrgId();
      return store.accounts.filter(
        (acc) => acc.orgId === orgId && acc.parentAccountId === parentId,
      );
    },
    findParentPath: async (accountId: string) => {
      const orgId = getActiveOrgId();
      const path: DBAccount[] = [];
      const visited = new Set<string>();
      let currentAcc = store.accounts.find(
        (a) => a.id === accountId && a.orgId === orgId,
      );

      while (currentAcc?.parentAccountId) {
        if (visited.has(currentAcc.parentAccountId)) {
          break; // Cycle protection
        }
        visited.add(currentAcc.parentAccountId);

        const parent = store.accounts.find(
          (a) => a.id === currentAcc?.parentAccountId && a.orgId === orgId,
        );
        if (!parent) break;
        path.push(parent);
        currentAcc = parent;
      }
      return path;
    },
    delete: async (id: string) => {
      const orgId = getActiveOrgId();
      const index = store.accounts.findIndex((a) => a.id === id);
      if (index === -1) return false;
      if (store.accounts[index].orgId !== orgId) {
        throw new Error("RLS Isolation Violation: Tenant mismatch.");
      }
      store.accounts.splice(index, 1);
      return true;
    },
  },
  contacts: {
    findMany: async () => {
      const orgId = getActiveOrgId();
      return store.contacts.filter((c) => c.orgId === orgId);
    },
    findOne: async (id: string) => {
      const orgId = getActiveOrgId();
      const c = store.contacts.find((x) => x.id === id);
      if (c && c.orgId !== orgId) {
        return null;
      }
      return c || null;
    },
    insert: async (c: Omit<DBContact, "id">) => {
      const orgId = getActiveOrgId();
      if (c.orgId !== orgId) {
        throw new Error("RLS Isolation Violation: Tenant mismatch.");
      }
      const newContact: DBContact = {
        ...c,
        reportsToId: c.reportsToId || null,
        id: `contact-${Math.random().toString(36).substring(2, 11)}`,
      };
      store.contacts.push(newContact);
      return newContact;
    },
    update: async (
      id: string,
      updates: Partial<Omit<DBContact, "id" | "orgId">>,
    ) => {
      const orgId = getActiveOrgId();
      const index = store.contacts.findIndex((c) => c.id === id);
      if (index === -1) return null;
      if (store.contacts[index].orgId !== orgId) {
        throw new Error("RLS Isolation Violation: Tenant mismatch.");
      }
      store.contacts[index] = { ...store.contacts[index], ...updates };
      return store.contacts[index];
    },
    findDirectReports: async (reportsToId: string) => {
      const orgId = getActiveOrgId();
      return store.contacts.filter(
        (c) => c.orgId === orgId && c.reportsToId === reportsToId,
      );
    },
    findParentPath: async (contactId: string) => {
      const orgId = getActiveOrgId();
      const path: DBContact[] = [];
      const visited = new Set<string>();

      const target = store.contacts.find(
        (c) => c.id === contactId && c.orgId === orgId,
      );
      if (!target) return [];

      let currentParentId = target.reportsToId;
      while (currentParentId) {
        if (visited.has(currentParentId)) break;
        visited.add(currentParentId);

        const parent = store.contacts.find(
          (c) => c.id === currentParentId && c.orgId === orgId,
        );
        if (!parent) break;
        path.push(parent);
        currentParentId = parent.reportsToId;
      }
      return path;
    },
    delete: async (id: string) => {
      const orgId = getActiveOrgId();
      const index = store.contacts.findIndex((c) => c.id === id);
      if (index === -1) return false;
      if (store.contacts[index].orgId !== orgId) {
        throw new Error("RLS Isolation Violation: Tenant mismatch.");
      }
      store.contacts.splice(index, 1);
      return true;
    },
  },
  opportunities: {
    findMany: async () => {
      const orgId = getActiveOrgId();
      return store.opportunities.filter((o) => o.orgId === orgId);
    },
    findOne: async (id: string) => {
      const orgId = getActiveOrgId();
      const o = store.opportunities.find((x) => x.id === id);
      if (o && o.orgId !== orgId) {
        return null;
      }
      return o || null;
    },
    insert: async (o: Omit<DBOpportunity, "id">) => {
      const orgId = getActiveOrgId();
      if (o.orgId !== orgId) {
        throw new Error("RLS Isolation Violation: Tenant mismatch.");
      }
      const newOpp: DBOpportunity = {
        ...o,
        currencyCode: o.currencyCode || "USD",
        amountCorporate: o.amountCorporate || null,
        id: `opp-${Math.random().toString(36).substring(2, 11)}`,
      };
      store.opportunities.push(newOpp);
      return newOpp;
    },
    update: async (
      id: string,
      updates: Partial<Omit<DBOpportunity, "id" | "orgId">>,
    ) => {
      const orgId = getActiveOrgId();
      const index = store.opportunities.findIndex((o) => o.id === id);
      if (index === -1) return null;
      if (store.opportunities[index].orgId !== orgId) {
        throw new Error("RLS Isolation Violation: Tenant mismatch.");
      }
      store.opportunities[index] = {
        ...store.opportunities[index],
        ...updates,
      };
      return store.opportunities[index];
    },
  },
  auditLogs: {
    findMany: async () => {
      const orgId = getActiveOrgId();
      return store.auditLogs.filter((log) => log.orgId === orgId);
    },
    insert: async (log: Omit<DBAuditLog, "id" | "createdAt">) => {
      const orgId = getActiveOrgId();
      if (log.orgId !== orgId) {
        throw new Error("RLS Isolation Violation: Tenant mismatch.");
      }
      const newLog: DBAuditLog = {
        ...log,
        id: `log-${Math.random().toString(36).substring(2, 11)}`,
        createdAt: new Date(),
      };
      store.auditLogs.push(newLog);
      return newLog;
    },
  },
  fieldDefinitions: {
    findMany: async () => {
      const orgId = getActiveOrgId();
      return store.fieldDefinitions.filter((def) => def.orgId === orgId);
    },
    insert: async (def: Omit<DBFieldDefinition, "id">) => {
      const orgId = getActiveOrgId();
      if (def.orgId !== orgId) {
        throw new Error("RLS Isolation Violation: Tenant mismatch.");
      }
      const newDef: DBFieldDefinition = {
        ...def,
        id: `field-${Math.random().toString(36).substring(2, 11)}`,
      };
      store.fieldDefinitions.push(newDef);
      return newDef;
    },
  },
  layoutDefinitions: {
    findMany: async () => {
      const orgId = getActiveOrgId();
      return store.layoutDefinitions.filter((layout) => layout.orgId === orgId);
    },
    findOne: async (objectType: string) => {
      const orgId = getActiveOrgId();
      const layout = store.layoutDefinitions.find(
        (lay) => lay.objectType === objectType && lay.orgId === orgId,
      );
      return layout || null;
    },
    insert: async (layout: Omit<DBLayoutDefinition, "id">) => {
      const orgId = getActiveOrgId();
      if (layout.orgId !== orgId) {
        throw new Error("RLS Isolation Violation: Tenant mismatch.");
      }
      const newLayout: DBLayoutDefinition = {
        ...layout,
        id: `layout-${Math.random().toString(36).substring(2, 11)}`,
      };
      store.layoutDefinitions.push(newLayout);
      return newLayout;
    },
  },
  workflows: {
    findMany: async () => {
      const orgId = getActiveOrgId();
      return store.workflows.filter((w) => w.orgId === orgId);
    },
    insert: async (w: Omit<DBWorkflow, "id">) => {
      const orgId = getActiveOrgId();
      if (w.orgId !== orgId) {
        throw new Error("RLS Isolation Violation: Tenant mismatch.");
      }
      const newWorkflow: DBWorkflow = {
        ...w,
        id: `workflow-${Math.random().toString(36).substring(2, 11)}`,
      };
      store.workflows.push(newWorkflow);
      return newWorkflow;
    },
  },
  tickets: {
    findMany: async () => {
      const orgId = getActiveOrgId();
      return store.tickets.filter((t) => t.orgId === orgId);
    },
    findOne: async (id: string) => {
      const orgId = getActiveOrgId();
      const ticket = store.tickets.find((t) => t.id === id);
      if (ticket && ticket.orgId !== orgId) {
        return null;
      }
      return ticket || null;
    },
    insert: async (ticket: Omit<DBTicket, "id" | "createdAt">) => {
      const orgId = getActiveOrgId();
      if (ticket.orgId !== orgId) {
        throw new Error("RLS Isolation Violation: Tenant mismatch.");
      }
      const newTicket: DBTicket = {
        ...ticket,
        id: `ticket-${Math.random().toString(36).substring(2, 11)}`,
        status: ticket.status || "Open",
        priority: ticket.priority || "Medium",
        createdAt: new Date(),
      };
      store.tickets.push(newTicket);
      return newTicket;
    },
    update: async (
      id: string,
      updates: Partial<Omit<DBTicket, "id" | "orgId" | "createdAt">>,
    ) => {
      const orgId = getActiveOrgId();
      const index = store.tickets.findIndex((t) => t.id === id);
      if (index === -1) return null;
      if (store.tickets[index].orgId !== orgId) {
        throw new Error("RLS Isolation Violation: Tenant mismatch.");
      }
      store.tickets[index] = { ...store.tickets[index], ...updates };
      return store.tickets[index];
    },
  },
  activities: {
    findMany: async () => {
      const orgId = getActiveOrgId();
      return store.activities.filter((act) => act.orgId === orgId);
    },
    findOne: async (id: string) => {
      const orgId = getActiveOrgId();
      const act = store.activities.find((a) => a.id === id);
      if (act && act.orgId !== orgId) {
        return null;
      }
      return act || null;
    },
    insert: async (
      act: Omit<DBActivity, "id" | "createdAt"> & { createdAt?: Date },
    ) => {
      const orgId = getActiveOrgId();
      if (act.orgId !== orgId) {
        throw new Error("RLS Isolation Violation: Tenant mismatch.");
      }
      const newAct: DBActivity = {
        ...act,
        id: `activity-${Math.random().toString(36).substring(2, 11)}`,
        createdAt: act.createdAt || new Date(),
      };
      store.activities.push(newAct);
      return newAct;
    },
  },
  activityLinks: {
    findMany: async () => {
      const orgId = getActiveOrgId();
      return store.activityLinks.filter((link) => link.orgId === orgId);
    },
    insert: async (link: Omit<DBActivityLink, "id">) => {
      const orgId = getActiveOrgId();
      if (link.orgId !== orgId) {
        throw new Error("RLS Isolation Violation: Tenant mismatch.");
      }
      const newLink: DBActivityLink = {
        ...link,
        id: `link-${Math.random().toString(36).substring(2, 11)}`,
      };
      store.activityLinks.push(newLink);
      return newLink;
    },
  },
  reports: {
    findMany: async () => {
      const orgId = getActiveOrgId();
      return store.reports.filter((r) => r.orgId === orgId);
    },
    findOne: async (id: string) => {
      const orgId = getActiveOrgId();
      const report = store.reports.find((r) => r.id === id);
      if (report && report.orgId !== orgId) {
        return null;
      }
      return report || null;
    },
    insert: async (report: Omit<DBReport, "id" | "createdAt">) => {
      const orgId = getActiveOrgId();
      if (report.orgId !== orgId) {
        throw new Error("RLS Isolation Violation: Tenant mismatch.");
      }
      const newReport: DBReport = {
        ...report,
        id: `report-${Math.random().toString(36).substring(2, 11)}`,
        createdAt: new Date(),
      };
      store.reports.push(newReport);
      return newReport;
    },
  },
  products: {
    findMany: async () => {
      const orgId = getActiveOrgId();
      return store.products.filter((p) => p.orgId === orgId);
    },
    findOne: async (id: string) => {
      const orgId = getActiveOrgId();
      const p = store.products.find((x) => x.id === id);
      if (p && p.orgId !== orgId) return null;
      return p || null;
    },
    insert: async (p: Omit<DBProduct, "id">) => {
      const orgId = getActiveOrgId();
      if (p.orgId !== orgId) {
        throw new Error("RLS Isolation Violation: Tenant mismatch.");
      }
      const newProduct: DBProduct = {
        ...p,
        id: `product-${Math.random().toString(36).substring(2, 11)}`,
      };
      store.products.push(newProduct);
      return newProduct;
    },
  },
  pricebooks: {
    findMany: async () => {
      const orgId = getActiveOrgId();
      return store.pricebooks.filter((pb) => pb.orgId === orgId);
    },
    findOne: async (id: string) => {
      const orgId = getActiveOrgId();
      const pb = store.pricebooks.find((x) => x.id === id);
      if (pb && pb.orgId !== orgId) return null;
      return pb || null;
    },
    insert: async (pb: Omit<DBPricebook, "id">) => {
      const orgId = getActiveOrgId();
      if (pb.orgId !== orgId) {
        throw new Error("RLS Isolation Violation: Tenant mismatch.");
      }
      const newPb: DBPricebook = {
        ...pb,
        id: `pricebook-${Math.random().toString(36).substring(2, 11)}`,
      };
      store.pricebooks.push(newPb);
      return newPb;
    },
  },
  pricebookEntries: {
    findMany: async () => {
      const orgId = getActiveOrgId();
      return store.pricebookEntries.filter((pbe) => pbe.orgId === orgId);
    },
    findOne: async (id: string) => {
      const orgId = getActiveOrgId();
      const pbe = store.pricebookEntries.find((x) => x.id === id);
      if (pbe && pbe.orgId !== orgId) return null;
      return pbe || null;
    },
    insert: async (pbe: Omit<DBPricebookEntry, "id">) => {
      const orgId = getActiveOrgId();
      if (pbe.orgId !== orgId) {
        throw new Error("RLS Isolation Violation: Tenant mismatch.");
      }
      const newPbe: DBPricebookEntry = {
        ...pbe,
        id: `pbe-${Math.random().toString(36).substring(2, 11)}`,
      };
      store.pricebookEntries.push(newPbe);
      return newPbe;
    },
  },
  opportunityProducts: {
    findMany: async () => {
      const orgId = getActiveOrgId();
      return store.opportunityProducts.filter((op) => op.orgId === orgId);
    },
    findOne: async (id: string) => {
      const orgId = getActiveOrgId();
      const op = store.opportunityProducts.find((x) => x.id === id);
      if (op && op.orgId !== orgId) return null;
      return op || null;
    },
    insert: async (op: Omit<DBOpportunityProduct, "id">) => {
      const orgId = getActiveOrgId();
      if (op.orgId !== orgId) {
        throw new Error("RLS Isolation Violation: Tenant mismatch.");
      }
      const newOp: DBOpportunityProduct = {
        ...op,
        id: `line-${Math.random().toString(36).substring(2, 11)}`,
      };
      store.opportunityProducts.push(newOp);
      return newOp;
    },
    update: async (
      id: string,
      updates: Partial<
        Omit<
          DBOpportunityProduct,
          "id" | "orgId" | "opportunityId" | "pricebookEntryId"
        >
      >,
    ) => {
      const orgId = getActiveOrgId();
      const index = store.opportunityProducts.findIndex((x) => x.id === id);
      if (index === -1) return null;
      if (store.opportunityProducts[index].orgId !== orgId) {
        throw new Error("RLS Isolation Violation: Tenant mismatch.");
      }
      store.opportunityProducts[index] = {
        ...store.opportunityProducts[index],
        ...updates,
      };
      return store.opportunityProducts[index];
    },
    delete: async (id: string) => {
      const orgId = getActiveOrgId();
      const index = store.opportunityProducts.findIndex((x) => x.id === id);
      if (index === -1) return false;
      if (store.opportunityProducts[index].orgId !== orgId) {
        throw new Error("RLS Isolation Violation: Tenant mismatch.");
      }
      store.opportunityProducts.splice(index, 1);
      return true;
    },
  },
  quotas: {
    findMany: async () => {
      const orgId = getActiveOrgId();
      return store.quotas.filter((q) => q.orgId === orgId);
    },
    insert: async (quota: Omit<DBQuota, "id">) => {
      const orgId = getActiveOrgId();
      if (quota.orgId !== orgId) {
        throw new Error("RLS Isolation Violation: Tenant mismatch.");
      }
      const newQuota: DBQuota = {
        ...quota,
        id: `quota-${Math.random().toString(36).substring(2, 11)}`,
      };
      store.quotas.push(newQuota);
      return newQuota;
    },
  },
  stageForecastMappings: {
    findMany: async () => {
      const orgId = getActiveOrgId();
      return store.stageForecastMappings.filter((m) => m.orgId === orgId);
    },
    upsert: async (m: Omit<DBStageForecastMapping, "id">) => {
      const orgId = getActiveOrgId();
      if (m.orgId !== orgId) {
        throw new Error("RLS Isolation Violation: Tenant mismatch.");
      }
      const existingIndex = store.stageForecastMappings.findIndex(
        (x) => x.orgId === orgId && x.stage === m.stage,
      );
      if (existingIndex !== -1) {
        store.stageForecastMappings[existingIndex].forecastCategory =
          m.forecastCategory;
        return store.stageForecastMappings[existingIndex];
      }
      const newMapping: DBStageForecastMapping = {
        ...m,
        id: `sfm-${Math.random().toString(36).substring(2, 11)}`,
      };
      store.stageForecastMappings.push(newMapping);
      return newMapping;
    },
  },
  forecastAdjustments: {
    findMany: async () => {
      const orgId = getActiveOrgId();
      return store.forecastAdjustments.filter((fa) => fa.orgId === orgId);
    },
    insert: async (fa: Omit<DBForecastAdjustment, "id" | "createdAt">) => {
      const orgId = getActiveOrgId();
      if (fa.orgId !== orgId) {
        throw new Error("RLS Isolation Violation: Tenant mismatch.");
      }
      const newFa: DBForecastAdjustment = {
        ...fa,
        id: `fa-${Math.random().toString(36).substring(2, 11)}`,
        createdAt: new Date(),
      };
      store.forecastAdjustments.push(newFa);
      return newFa;
    },
  },
  stageProbabilities: {
    findMany: async () => {
      const orgId = getActiveOrgId();
      return store.stageProbabilities.filter((sp) => sp.orgId === orgId);
    },
    upsert: async (sp: Omit<DBStageProbability, "id">) => {
      const orgId = getActiveOrgId();
      if (sp.orgId !== orgId) {
        throw new Error("RLS Isolation Violation: Tenant mismatch.");
      }
      const existingIndex = store.stageProbabilities.findIndex(
        (x) => x.orgId === orgId && x.stage === sp.stage,
      );
      if (existingIndex !== -1) {
        store.stageProbabilities[existingIndex].probability = sp.probability;
        return store.stageProbabilities[existingIndex];
      }
      const newSp: DBStageProbability = {
        ...sp,
        id: `sp-${Math.random().toString(36).substring(2, 11)}`,
      };
      store.stageProbabilities.push(newSp);
      return newSp;
    },
  },
  webhooks: {
    findMany: async () => {
      const orgId = getActiveOrgId();
      return store.webhooks.filter((w) => w.orgId === orgId);
    },
    insert: async (webhook: Omit<DBWebhook, "id">) => {
      const orgId = getActiveOrgId();
      if (webhook.orgId !== orgId) {
        throw new Error("RLS Isolation Violation: Tenant mismatch.");
      }
      const newWebhook: DBWebhook = {
        ...webhook,
        id: `webhook-${Math.random().toString(36).substring(2, 11)}`,
      };
      store.webhooks.push(newWebhook);
      return newWebhook;
    },
  },
  webhookDeliveries: {
    findMany: async () => {
      const orgId = getActiveOrgId();
      return store.webhookDeliveries.filter((d) => d.orgId === orgId);
    },
    insert: async (delivery: Omit<DBWebhookDelivery, "id" | "createdAt">) => {
      const orgId = getActiveOrgId();
      if (delivery.orgId !== orgId) {
        throw new Error("RLS Isolation Violation: Tenant mismatch.");
      }
      const newDelivery: DBWebhookDelivery = {
        ...delivery,
        id: `delivery-${Math.random().toString(36).substring(2, 11)}`,
        createdAt: new Date(),
      };
      store.webhookDeliveries.push(newDelivery);
      return newDelivery;
    },
  },
  documentTemplates: {
    findMany: async () => {
      const orgId = getActiveOrgId();
      return store.documentTemplates.filter((t) => t.orgId === orgId);
    },
    findOne: async (id: string) => {
      const orgId = getActiveOrgId();
      const t = store.documentTemplates.find((x) => x.id === id);
      if (t && t.orgId !== orgId) return null;
      return t || null;
    },
    insert: async (template: Omit<DBDocumentTemplate, "id" | "createdAt">) => {
      const orgId = getActiveOrgId();
      if (template.orgId !== orgId) {
        throw new Error("RLS Isolation Violation: Tenant mismatch.");
      }
      const newTemplate: DBDocumentTemplate = {
        ...template,
        id: `template-${Math.random().toString(36).substring(2, 11)}`,
        createdAt: new Date(),
      };
      store.documentTemplates.push(newTemplate);
      return newTemplate;
    },
  },
  mergedDocuments: {
    findMany: async () => {
      const orgId = getActiveOrgId();
      return store.mergedDocuments.filter((d) => d.orgId === orgId);
    },
    insert: async (merged: Omit<DBMergedDocument, "id" | "createdAt">) => {
      const orgId = getActiveOrgId();
      if (merged.orgId !== orgId) {
        throw new Error("RLS Isolation Violation: Tenant mismatch.");
      }
      const newMerged: DBMergedDocument = {
        ...merged,
        id: `merged-${Math.random().toString(36).substring(2, 11)}`,
        createdAt: new Date(),
      };
      store.mergedDocuments.push(newMerged);
      return newMerged;
    },
  },
  subscriptions: {
    findMany: async () => {
      const orgId = getActiveOrgId();
      return store.subscriptions.filter((s) => s.orgId === orgId);
    },
    findOne: async (id: string) => {
      const orgId = getActiveOrgId();
      const s = store.subscriptions.find((x) => x.id === id);
      if (s && s.orgId !== orgId) return null;
      return s || null;
    },
    insert: async (sub: Omit<DBSubscription, "id">) => {
      const orgId = getActiveOrgId();
      if (sub.orgId !== orgId) {
        throw new Error("RLS Isolation Violation: Tenant mismatch.");
      }
      const newSub: DBSubscription = {
        ...sub,
        id: `subscription-${Math.random().toString(36).substring(2, 11)}`,
      };
      store.subscriptions.push(newSub);
      return newSub;
    },
    update: async (
      id: string,
      updates: Partial<Omit<DBSubscription, "id" | "orgId">>,
    ) => {
      const orgId = getActiveOrgId();
      const index = store.subscriptions.findIndex((s) => s.id === id);
      if (index === -1) return null;
      if (store.subscriptions[index].orgId !== orgId) {
        throw new Error("RLS Isolation Violation: Tenant mismatch.");
      }
      store.subscriptions[index] = {
        ...store.subscriptions[index],
        ...updates,
      };
      return store.subscriptions[index];
    },
  },
  invoices: {
    findMany: async () => {
      const orgId = getActiveOrgId();
      return store.invoices.filter((i) => i.orgId === orgId);
    },
    findOne: async (id: string) => {
      const orgId = getActiveOrgId();
      const i = store.invoices.find((x) => x.id === id);
      if (i && i.orgId !== orgId) return null;
      return i || null;
    },
    insert: async (inv: Omit<DBInvoice, "id">) => {
      const orgId = getActiveOrgId();
      if (inv.orgId !== orgId) {
        throw new Error("RLS Isolation Violation: Tenant mismatch.");
      }
      const newInv: DBInvoice = {
        ...inv,
        id: `invoice-${Math.random().toString(36).substring(2, 11)}`,
      };
      store.invoices.push(newInv);
      return newInv;
    },
    update: async (
      id: string,
      updates: Partial<Omit<DBInvoice, "id" | "orgId">>,
    ) => {
      const orgId = getActiveOrgId();
      const index = store.invoices.findIndex((i) => i.id === id);
      if (index === -1) return null;
      if (store.invoices[index].orgId !== orgId) {
        throw new Error("RLS Isolation Violation: Tenant mismatch.");
      }
      store.invoices[index] = {
        ...store.invoices[index],
        ...updates,
      };
      return store.invoices[index];
    },
  },
  webhookOutbox: {
    findMany: async () => {
      const orgId = getActiveOrgId();
      return store.webhookOutbox.filter((o) => o.orgId === orgId);
    },
    findOne: async (id: string) => {
      const orgId = getActiveOrgId();
      const o = store.webhookOutbox.find((x) => x.id === id);
      if (o && o.orgId !== orgId) return null;
      return o || null;
    },
    insert: async (o: Omit<DBWebhookOutbox, "id" | "createdAt">) => {
      const orgId = getActiveOrgId();
      if (o.orgId !== orgId) {
        throw new Error("RLS Isolation Violation: Tenant mismatch.");
      }
      const newOutbox: DBWebhookOutbox = {
        ...o,
        id: `outbox-${Math.random().toString(36).substring(2, 11)}`,
        createdAt: new Date(),
      };
      store.webhookOutbox.push(newOutbox);
      return newOutbox;
    },
    update: async (
      id: string,
      updates: Partial<Omit<DBWebhookOutbox, "id" | "orgId" | "createdAt">>,
    ) => {
      const orgId = getActiveOrgId();
      const index = store.webhookOutbox.findIndex((o) => o.id === id);
      if (index === -1) return null;
      if (store.webhookOutbox[index].orgId !== orgId) {
        throw new Error("RLS Isolation Violation: Tenant mismatch.");
      }
      store.webhookOutbox[index] = {
        ...store.webhookOutbox[index],
        ...updates,
      };
      return store.webhookOutbox[index];
    },
    delete: async (id: string) => {
      const orgId = getActiveOrgId();
      const index = store.webhookOutbox.findIndex((o) => o.id === id);
      if (index === -1) return false;
      if (store.webhookOutbox[index].orgId !== orgId) {
        throw new Error("RLS Isolation Violation: Tenant mismatch.");
      }
      store.webhookOutbox.splice(index, 1);
      return true;
    },
  },
  webhookDlq: {
    findMany: async () => {
      const orgId = getActiveOrgId();
      return store.webhookDlq.filter((d) => d.orgId === orgId);
    },
    findOne: async (id: string) => {
      const orgId = getActiveOrgId();
      const d = store.webhookDlq.find((x) => x.id === id);
      if (d && d.orgId !== orgId) return null;
      return d || null;
    },
    insert: async (d: Omit<DBWebhookDlq, "id" | "failedAt">) => {
      const orgId = getActiveOrgId();
      if (d.orgId !== orgId) {
        throw new Error("RLS Isolation Violation: Tenant mismatch.");
      }
      const newDlq: DBWebhookDlq = {
        ...d,
        id: `dlq-${Math.random().toString(36).substring(2, 11)}`,
        failedAt: new Date(),
      };
      store.webhookDlq.push(newDlq);
      return newDlq;
    },
  },
  opportunityApprovals: {
    findMany: async () => {
      const orgId = getActiveOrgId();
      return store.opportunityApprovals.filter((a) => a.orgId === orgId);
    },
    findOne: async (id: string) => {
      const orgId = getActiveOrgId();
      const a = store.opportunityApprovals.find((x) => x.id === id);
      if (a && a.orgId !== orgId) return null;
      return a || null;
    },
    insert: async (appr: Omit<DBOpportunityApproval, "id" | "createdAt">) => {
      const orgId = getActiveOrgId();
      if (appr.orgId !== orgId) {
        throw new Error("RLS Isolation Violation: Tenant mismatch.");
      }
      const newAppr: DBOpportunityApproval = {
        ...appr,
        id: `approval-${Math.random().toString(36).substring(2, 11)}`,
        createdAt: new Date(),
      };
      store.opportunityApprovals.push(newAppr);
      return newAppr;
    },
    update: async (
      id: string,
      updates: Partial<
        Omit<DBOpportunityApproval, "id" | "orgId" | "createdAt">
      >,
    ) => {
      const orgId = getActiveOrgId();
      const index = store.opportunityApprovals.findIndex((a) => a.id === id);
      if (index === -1) return null;
      if (store.opportunityApprovals[index].orgId !== orgId) {
        throw new Error("RLS Isolation Violation: Tenant mismatch.");
      }
      store.opportunityApprovals[index] = {
        ...store.opportunityApprovals[index],
        ...updates,
      };
      return store.opportunityApprovals[index];
    },
  },
  opportunityApprovalSteps: {
    findMany: async () => {
      const orgId = getActiveOrgId();
      return store.opportunityApprovalSteps.filter((s) => s.orgId === orgId);
    },
    findOne: async (id: string) => {
      const orgId = getActiveOrgId();
      const s = store.opportunityApprovalSteps.find((x) => x.id === id);
      if (s && s.orgId !== orgId) return null;
      return s || null;
    },
    insert: async (step: Omit<DBOpportunityApprovalStep, "id">) => {
      const orgId = getActiveOrgId();
      if (step.orgId !== orgId) {
        throw new Error("RLS Isolation Violation: Tenant mismatch.");
      }
      const newStep: DBOpportunityApprovalStep = {
        ...step,
        id: `step-${Math.random().toString(36).substring(2, 11)}`,
      };
      store.opportunityApprovalSteps.push(newStep);
      return newStep;
    },
    update: async (
      id: string,
      updates: Partial<Omit<DBOpportunityApprovalStep, "id" | "orgId">>,
    ) => {
      const orgId = getActiveOrgId();
      const index = store.opportunityApprovalSteps.findIndex(
        (s) => s.id === id,
      );
      if (index === -1) return null;
      if (store.opportunityApprovalSteps[index].orgId !== orgId) {
        throw new Error("RLS Isolation Violation: Tenant mismatch.");
      }
      store.opportunityApprovalSteps[index] = {
        ...store.opportunityApprovalSteps[index],
        ...updates,
      };
      return store.opportunityApprovalSteps[index];
    },
  },
  commissions: {
    findMany: async () => {
      const orgId = getActiveOrgId();
      return store.commissions.filter((c) => c.orgId === orgId);
    },
    findOne: async (id: string) => {
      const orgId = getActiveOrgId();
      const c = store.commissions.find((x) => x.id === id);
      if (c && c.orgId !== orgId) return null;
      return c || null;
    },
    insert: async (comm: Omit<DBCommission, "id" | "createdAt">) => {
      const orgId = getActiveOrgId();
      if (comm.orgId !== orgId) {
        throw new Error("RLS Isolation Violation: Tenant mismatch.");
      }
      const newComm: DBCommission = {
        ...comm,
        id: `commission-${Math.random().toString(36).substring(2, 11)}`,
        createdAt: new Date(),
      };
      store.commissions.push(newComm);
      return newComm;
    },
    update: async (
      id: string,
      updates: Partial<Omit<DBCommission, "id" | "orgId" | "createdAt">>,
    ) => {
      const orgId = getActiveOrgId();
      const index = store.commissions.findIndex((c) => c.id === id);
      if (index === -1) return null;
      if (store.commissions[index].orgId !== orgId) {
        throw new Error("RLS Isolation Violation: Tenant mismatch.");
      }
      store.commissions[index] = {
        ...store.commissions[index],
        ...updates,
      };
      return store.commissions[index];
    },
    delete: async (id: string) => {
      const orgId = getActiveOrgId();
      const index = store.commissions.findIndex((c) => c.id === id);
      if (index === -1) return false;
      if (store.commissions[index].orgId !== orgId) {
        throw new Error("RLS Isolation Violation: Tenant mismatch.");
      }
      store.commissions.splice(index, 1);
      return true;
    },
    deleteManyForOpportunity: async (opportunityId: string) => {
      const orgId = getActiveOrgId();
      store.commissions = store.commissions.filter(
        (c) => !(c.opportunityId === opportunityId && c.orgId === orgId),
      );
      return true;
    },
  },
  leadAssignmentRules: {
    findMany: async () => {
      const orgId = getActiveOrgId();
      return store.leadAssignmentRules.filter((r) => r.orgId === orgId);
    },
    findOne: async (id: string) => {
      const orgId = getActiveOrgId();
      const r = store.leadAssignmentRules.find((x) => x.id === id);
      if (r && r.orgId !== orgId) return null;
      return r || null;
    },
    insert: async (rule: Omit<DBLeadAssignmentRule, "id" | "createdAt">) => {
      const orgId = getActiveOrgId();
      if (rule.orgId !== orgId) {
        throw new Error("RLS Isolation Violation: Tenant mismatch.");
      }
      const newRule: DBLeadAssignmentRule = {
        ...rule,
        id: `rule-${Math.random().toString(36).substring(2, 11)}`,
        createdAt: new Date(),
      };
      store.leadAssignmentRules.push(newRule);
      return newRule;
    },
    update: async (
      id: string,
      updates: Partial<
        Omit<DBLeadAssignmentRule, "id" | "orgId" | "createdAt">
      >,
    ) => {
      const orgId = getActiveOrgId();
      const index = store.leadAssignmentRules.findIndex((r) => r.id === id);
      if (index === -1) return null;
      if (store.leadAssignmentRules[index].orgId !== orgId) {
        throw new Error("RLS Isolation Violation: Tenant mismatch.");
      }
      store.leadAssignmentRules[index] = {
        ...store.leadAssignmentRules[index],
        ...updates,
      };
      return store.leadAssignmentRules[index];
    },
  },
  leadAssignmentRuleEntries: {
    findMany: async () => {
      const orgId = getActiveOrgId();
      return store.leadAssignmentRuleEntries.filter((e) => e.orgId === orgId);
    },
    findOne: async (id: string) => {
      const orgId = getActiveOrgId();
      const e = store.leadAssignmentRuleEntries.find((x) => x.id === id);
      if (e && e.orgId !== orgId) return null;
      return e || null;
    },
    insert: async (entry: Omit<DBLeadAssignmentRuleEntry, "id">) => {
      const orgId = getActiveOrgId();
      if (entry.orgId !== orgId) {
        throw new Error("RLS Isolation Violation: Tenant mismatch.");
      }
      const newEntry: DBLeadAssignmentRuleEntry = {
        ...entry,
        id: `entry-${Math.random().toString(36).substring(2, 11)}`,
      };
      store.leadAssignmentRuleEntries.push(newEntry);
      return newEntry;
    },
    update: async (
      id: string,
      updates: Partial<Omit<DBLeadAssignmentRuleEntry, "id" | "orgId">>,
    ) => {
      const orgId = getActiveOrgId();
      const index = store.leadAssignmentRuleEntries.findIndex(
        (e) => e.id === id,
      );
      if (index === -1) return null;
      if (store.leadAssignmentRuleEntries[index].orgId !== orgId) {
        throw new Error("RLS Isolation Violation: Tenant mismatch.");
      }
      store.leadAssignmentRuleEntries[index] = {
        ...store.leadAssignmentRuleEntries[index],
        ...updates,
      };
      return store.leadAssignmentRuleEntries[index];
    },
  },
  territories: {
    findMany: async () => {
      const orgId = getActiveOrgId();
      return store.territories.filter((t) => t.orgId === orgId);
    },
    findOne: async (id: string) => {
      const orgId = getActiveOrgId();
      const t = store.territories.find((x) => x.id === id);
      if (t && t.orgId !== orgId) return null;
      return t || null;
    },
    insert: async (territory: Omit<DBTerritory, "id" | "createdAt">) => {
      const orgId = getActiveOrgId();
      if (territory.orgId !== orgId) {
        throw new Error("RLS Isolation Violation: Tenant mismatch.");
      }
      const newTerritory: DBTerritory = {
        ...territory,
        id: `territory-${Math.random().toString(36).substring(2, 11)}`,
        createdAt: new Date(),
      };
      store.territories.push(newTerritory);
      return newTerritory;
    },
    update: async (
      id: string,
      updates: Partial<Omit<DBTerritory, "id" | "orgId" | "createdAt">>,
    ) => {
      const orgId = getActiveOrgId();
      const index = store.territories.findIndex((t) => t.id === id);
      if (index === -1) return null;
      if (store.territories[index].orgId !== orgId) {
        throw new Error("RLS Isolation Violation: Tenant mismatch.");
      }
      store.territories[index] = {
        ...store.territories[index],
        ...updates,
      };
      return store.territories[index];
    },
  },
  territoryMembers: {
    findMany: async () => {
      const orgId = getActiveOrgId();
      return store.territoryMembers.filter((m) => m.orgId === orgId);
    },
    findOne: async (id: string) => {
      const orgId = getActiveOrgId();
      const m = store.territoryMembers.find((x) => x.id === id);
      if (m && m.orgId !== orgId) return null;
      return m || null;
    },
    insert: async (member: Omit<DBTerritoryMember, "id">) => {
      const orgId = getActiveOrgId();
      if (member.orgId !== orgId) {
        throw new Error("RLS Isolation Violation: Tenant mismatch.");
      }
      const newMember: DBTerritoryMember = {
        ...member,
        id: `member-${Math.random().toString(36).substring(2, 11)}`,
      };
      store.territoryMembers.push(newMember);
      return newMember;
    },
    delete: async (id: string) => {
      const orgId = getActiveOrgId();
      const index = store.territoryMembers.findIndex((m) => m.id === id);
      if (index === -1) return false;
      if (store.territoryMembers[index].orgId !== orgId) {
        throw new Error("RLS Isolation Violation: Tenant mismatch.");
      }
      store.territoryMembers.splice(index, 1);
      return true;
    },
  },
  opportunitySplits: {
    findMany: async () => {
      const orgId = getActiveOrgId();
      return store.opportunitySplits.filter((s) => s.orgId === orgId);
    },
    findForOpportunity: async (opportunityId: string) => {
      const orgId = getActiveOrgId();
      return store.opportunitySplits.filter(
        (s) => s.opportunityId === opportunityId && s.orgId === orgId,
      );
    },
    findOne: async (id: string) => {
      const orgId = getActiveOrgId();
      const s = store.opportunitySplits.find((x) => x.id === id);
      if (s && s.orgId !== orgId) return null;
      return s || null;
    },
    insert: async (split: Omit<DBOpportunitySplit, "id" | "createdAt">) => {
      const orgId = getActiveOrgId();
      if (split.orgId !== orgId) {
        throw new Error("RLS Isolation Violation: Tenant mismatch.");
      }
      const newSplit: DBOpportunitySplit = {
        ...split,
        id: `split-${Math.random().toString(36).substring(2, 11)}`,
        createdAt: new Date(),
      };
      store.opportunitySplits.push(newSplit);
      return newSplit;
    },
    delete: async (id: string) => {
      const orgId = getActiveOrgId();
      const index = store.opportunitySplits.findIndex((s) => s.id === id);
      if (index === -1) return false;
      if (store.opportunitySplits[index].orgId !== orgId) {
        throw new Error("RLS Isolation Violation: Tenant mismatch.");
      }
      store.opportunitySplits.splice(index, 1);
      return true;
    },
    deleteManyForOpportunity: async (opportunityId: string) => {
      const orgId = getActiveOrgId();
      store.opportunitySplits = store.opportunitySplits.filter(
        (s) => !(s.opportunityId === opportunityId && s.orgId === orgId),
      );
      return true;
    },
  },
  campaigns: {
    findMany: async () => {
      const orgId = getActiveOrgId();
      return store.campaigns.filter((c) => c.orgId === orgId);
    },
    findOne: async (id: string) => {
      const orgId = getActiveOrgId();
      const c = store.campaigns.find((x) => x.id === id);
      if (c && c.orgId !== orgId) return null;
      return c || null;
    },
    insert: async (campaign: Omit<DBCampaign, "id" | "createdAt">) => {
      const orgId = getActiveOrgId();
      if (campaign.orgId !== orgId) {
        throw new Error("RLS Isolation Violation: Tenant mismatch.");
      }
      const newCampaign: DBCampaign = {
        ...campaign,
        id: `campaign-${Math.random().toString(36).substring(2, 11)}`,
        createdAt: new Date(),
      };
      store.campaigns.push(newCampaign);
      return newCampaign;
    },
    update: async (
      id: string,
      updates: Partial<Omit<DBCampaign, "id" | "orgId" | "createdAt">>,
    ) => {
      const orgId = getActiveOrgId();
      const index = store.campaigns.findIndex((c) => c.id === id);
      if (index === -1) return null;
      if (store.campaigns[index].orgId !== orgId) {
        throw new Error("RLS Isolation Violation: Tenant mismatch.");
      }
      store.campaigns[index] = {
        ...store.campaigns[index],
        ...updates,
      };
      return store.campaigns[index];
    },
    delete: async (id: string) => {
      const orgId = getActiveOrgId();
      const index = store.campaigns.findIndex((c) => c.id === id);
      if (index === -1) return false;
      if (store.campaigns[index].orgId !== orgId) {
        throw new Error("RLS Isolation Violation: Tenant mismatch.");
      }
      store.campaigns.splice(index, 1);
      return true;
    },
  },
  campaignMembers: {
    findMany: async () => {
      const orgId = getActiveOrgId();
      return store.campaignMembers.filter((m) => m.orgId === orgId);
    },
    findForCampaign: async (campaignId: string) => {
      const orgId = getActiveOrgId();
      return store.campaignMembers.filter(
        (m) => m.campaignId === campaignId && m.orgId === orgId,
      );
    },
    findOne: async (id: string) => {
      const orgId = getActiveOrgId();
      const m = store.campaignMembers.find((x) => x.id === id);
      if (m && m.orgId !== orgId) return null;
      return m || null;
    },
    insert: async (member: Omit<DBCampaignMember, "id" | "createdAt">) => {
      const orgId = getActiveOrgId();
      if (member.orgId !== orgId) {
        throw new Error("RLS Isolation Violation: Tenant mismatch.");
      }
      // Check for duplicates
      const exists = store.campaignMembers.some(
        (m) =>
          m.campaignId === member.campaignId &&
          m.orgId === orgId &&
          ((member.leadId && m.leadId === member.leadId) ||
            (member.contactId && m.contactId === member.contactId)),
      );
      if (exists) {
        throw new Error("Duplicate campaign member registration.");
      }
      const newMember: DBCampaignMember = {
        ...member,
        id: `member-${Math.random().toString(36).substring(2, 11)}`,
        createdAt: new Date(),
      };
      store.campaignMembers.push(newMember);
      return newMember;
    },
    update: async (
      id: string,
      updates: Partial<
        Omit<
          DBCampaignMember,
          "id" | "orgId" | "campaignId" | "leadId" | "contactId" | "createdAt"
        >
      >,
    ) => {
      const orgId = getActiveOrgId();
      const index = store.campaignMembers.findIndex((m) => m.id === id);
      if (index === -1) return null;
      if (store.campaignMembers[index].orgId !== orgId) {
        throw new Error("RLS Isolation Violation: Tenant mismatch.");
      }
      store.campaignMembers[index] = {
        ...store.campaignMembers[index],
        ...updates,
      };
      return store.campaignMembers[index];
    },
    delete: async (id: string) => {
      const orgId = getActiveOrgId();
      const index = store.campaignMembers.findIndex((m) => m.id === id);
      if (index === -1) return false;
      if (store.campaignMembers[index].orgId !== orgId) {
        throw new Error("RLS Isolation Violation: Tenant mismatch.");
      }
      store.campaignMembers.splice(index, 1);
      return true;
    },
  },
  opportunityStageHistory: {
    findMany: async () => {
      const orgId = getActiveOrgId();
      return store.opportunityStageHistory.filter((h) => h.orgId === orgId);
    },
    findForOpportunity: async (opportunityId: string) => {
      const orgId = getActiveOrgId();
      return store.opportunityStageHistory.filter(
        (h) => h.opportunityId === opportunityId && h.orgId === orgId,
      );
    },
    insert: async (
      history: Omit<DBOpportunityStageHistory, "id" | "createdAt">,
    ) => {
      const orgId = getActiveOrgId();
      if (history.orgId !== orgId) {
        throw new Error("RLS Isolation Violation: Tenant mismatch.");
      }
      const newHistory: DBOpportunityStageHistory = {
        ...history,
        id: `history-${Math.random().toString(36).substring(2, 11)}`,
        createdAt: new Date(),
      };
      store.opportunityStageHistory.push(newHistory);
      return newHistory;
    },
  },
  opportunityContactRoles: {
    findMany: async () => {
      const orgId = getActiveOrgId();
      return store.opportunityContactRoles.filter((r) => r.orgId === orgId);
    },
    findForOpportunity: async (opportunityId: string) => {
      const orgId = getActiveOrgId();
      return store.opportunityContactRoles.filter(
        (r) => r.opportunityId === opportunityId && r.orgId === orgId,
      );
    },
    findOne: async (id: string) => {
      const orgId = getActiveOrgId();
      const r = store.opportunityContactRoles.find((x) => x.id === id);
      if (r && r.orgId !== orgId) return null;
      return r || null;
    },
    insert: async (
      role: Omit<DBOpportunityContactRole, "id" | "createdAt">,
    ) => {
      const orgId = getActiveOrgId();
      if (role.orgId !== orgId) {
        throw new Error("RLS Isolation Violation: Tenant mismatch.");
      }
      const newRole: DBOpportunityContactRole = {
        ...role,
        id: `ocr-${Math.random().toString(36).substring(2, 11)}`,
        createdAt: new Date(),
      };
      store.opportunityContactRoles.push(newRole);
      return newRole;
    },
    update: async (
      id: string,
      updates: Partial<
        Omit<DBOpportunityContactRole, "id" | "orgId" | "createdAt">
      >,
    ) => {
      const orgId = getActiveOrgId();
      const index = store.opportunityContactRoles.findIndex((r) => r.id === id);
      if (index === -1) return null;
      if (store.opportunityContactRoles[index].orgId !== orgId) {
        throw new Error("RLS Isolation Violation: Tenant mismatch.");
      }
      store.opportunityContactRoles[index] = {
        ...store.opportunityContactRoles[index],
        ...updates,
      };
      return store.opportunityContactRoles[index];
    },
    delete: async (id: string) => {
      const orgId = getActiveOrgId();
      const index = store.opportunityContactRoles.findIndex((r) => r.id === id);
      if (index === -1) return false;
      if (store.opportunityContactRoles[index].orgId !== orgId) {
        throw new Error("RLS Isolation Violation: Tenant mismatch.");
      }
      store.opportunityContactRoles.splice(index, 1);
      return true;
    },
  },
  campaignInfluence: {
    findMany: async () => {
      const orgId = getActiveOrgId();
      return store.campaignInfluence.filter((r) => r.orgId === orgId);
    },
    findForOpportunity: async (opportunityId: string) => {
      const orgId = getActiveOrgId();
      return store.campaignInfluence.filter(
        (r) => r.opportunityId === opportunityId && r.orgId === orgId,
      );
    },
    findOne: async (id: string) => {
      const orgId = getActiveOrgId();
      const r = store.campaignInfluence.find((x) => x.id === id);
      if (r && r.orgId !== orgId) return null;
      return r || null;
    },
    insert: async (inf: Omit<DBCampaignInfluence, "id" | "createdAt">) => {
      const orgId = getActiveOrgId();
      if (inf.orgId !== orgId) {
        throw new Error("RLS Isolation Violation: Tenant mismatch.");
      }
      const newInfluence: DBCampaignInfluence = {
        ...inf,
        id: `cinf-${Math.random().toString(36).substring(2, 11)}`,
        createdAt: new Date(),
      };
      store.campaignInfluence.push(newInfluence);
      return newInfluence;
    },
    delete: async (id: string) => {
      const orgId = getActiveOrgId();
      const index = store.campaignInfluence.findIndex((r) => r.id === id);
      if (index === -1) return false;
      if (store.campaignInfluence[index].orgId !== orgId) {
        throw new Error("RLS Isolation Violation: Tenant mismatch.");
      }
      store.campaignInfluence.splice(index, 1);
      return true;
    },
  },
  contracts: {
    findMany: async () => {
      const orgId = getActiveOrgId();
      return store.contracts.filter((c) => c.orgId === orgId);
    },
    findForAccount: async (accountId: string) => {
      const orgId = getActiveOrgId();
      return store.contracts.filter(
        (c) => c.accountId === accountId && c.orgId === orgId,
      );
    },
    findOne: async (id: string) => {
      const orgId = getActiveOrgId();
      const c = store.contracts.find((x) => x.id === id);
      if (c && c.orgId !== orgId) return null;
      return c || null;
    },
    insert: async (contract: Omit<DBContract, "id" | "createdAt">) => {
      const orgId = getActiveOrgId();
      if (contract.orgId !== orgId) {
        throw new Error("RLS Isolation Violation: Tenant mismatch.");
      }
      const newContract: DBContract = {
        ...contract,
        id: `contract-${Math.random().toString(36).substring(2, 11)}`,
        createdAt: new Date(),
      };
      store.contracts.push(newContract);
      return newContract;
    },
    update: async (
      id: string,
      updates: Partial<Omit<DBContract, "id" | "orgId" | "createdAt">>,
    ) => {
      const orgId = getActiveOrgId();
      const index = store.contracts.findIndex((c) => c.id === id);
      if (index === -1) return null;
      if (store.contracts[index].orgId !== orgId) {
        throw new Error("RLS Isolation Violation: Tenant mismatch.");
      }
      store.contracts[index] = {
        ...store.contracts[index],
        ...updates,
      };
      return store.contracts[index];
    },
    delete: async (id: string) => {
      const orgId = getActiveOrgId();
      const index = store.contracts.findIndex((c) => c.id === id);
      if (index === -1) return false;
      if (store.contracts[index].orgId !== orgId) {
        throw new Error("RLS Isolation Violation: Tenant mismatch.");
      }
      store.contracts.splice(index, 1);
      return true;
    },
  },
  leadSlaTargets: {
    findMany: async () => {
      const orgId = getActiveOrgId();
      return store.leadSlaTargets.filter((t) => t.orgId === orgId);
    },
    findOne: async (id: string) => {
      const orgId = getActiveOrgId();
      const t = store.leadSlaTargets.find((x) => x.id === id);
      if (t && t.orgId !== orgId) return null;
      return t || null;
    },
    insert: async (target: Omit<DBLeadSlaTarget, "id" | "createdAt">) => {
      const orgId = getActiveOrgId();
      if (target.orgId !== orgId) {
        throw new Error("RLS Isolation Violation: Tenant mismatch.");
      }
      const newTarget: DBLeadSlaTarget = {
        ...target,
        id: `target-${Math.random().toString(36).substring(2, 11)}`,
        createdAt: new Date(),
      };
      store.leadSlaTargets.push(newTarget);
      return newTarget;
    },
    update: async (
      id: string,
      updates: Partial<Omit<DBLeadSlaTarget, "id" | "orgId" | "createdAt">>,
    ) => {
      const orgId = getActiveOrgId();
      const index = store.leadSlaTargets.findIndex((t) => t.id === id);
      if (index === -1) return null;
      if (store.leadSlaTargets[index].orgId !== orgId) {
        throw new Error("RLS Isolation Violation: Tenant mismatch.");
      }
      store.leadSlaTargets[index] = {
        ...store.leadSlaTargets[index],
        ...updates,
      };
      return store.leadSlaTargets[index];
    },
  },
  leadSlaTrackers: {
    findMany: async () => {
      const orgId = getActiveOrgId();
      return store.leadSlaTrackers.filter((t) => t.orgId === orgId);
    },
    findOne: async (id: string) => {
      const orgId = getActiveOrgId();
      const t = store.leadSlaTrackers.find((x) => x.id === id);
      if (t && t.orgId !== orgId) return null;
      return t || null;
    },
    findForLead: async (leadId: string) => {
      const orgId = getActiveOrgId();
      return store.leadSlaTrackers.filter(
        (t) => t.leadId === leadId && t.orgId === orgId,
      );
    },
    insert: async (tracker: Omit<DBLeadSlaTracker, "id" | "createdAt">) => {
      const orgId = getActiveOrgId();
      if (tracker.orgId !== orgId) {
        throw new Error("RLS Isolation Violation: Tenant mismatch.");
      }
      const newTracker: DBLeadSlaTracker = {
        ...tracker,
        id: `tracker-${Math.random().toString(36).substring(2, 11)}`,
        createdAt: new Date(),
      };
      store.leadSlaTrackers.push(newTracker);
      return newTracker;
    },
    update: async (
      id: string,
      updates: Partial<Omit<DBLeadSlaTracker, "id" | "orgId" | "createdAt">>,
    ) => {
      const orgId = getActiveOrgId();
      const index = store.leadSlaTrackers.findIndex((t) => t.id === id);
      if (index === -1) return null;
      if (store.leadSlaTrackers[index].orgId !== orgId) {
        throw new Error("RLS Isolation Violation: Tenant mismatch.");
      }
      store.leadSlaTrackers[index] = {
        ...store.leadSlaTrackers[index],
        ...updates,
      };
      return store.leadSlaTrackers[index];
    },
  },
  accountTeams: {
    findMany: async () => {
      const orgId = getActiveOrgId();
      return store.accountTeams.filter((t) => t.orgId === orgId);
    },
    findForAccount: async (accountId: string) => {
      const orgId = getActiveOrgId();
      return store.accountTeams.filter(
        (t) => t.accountId === accountId && t.orgId === orgId,
      );
    },
    insert: async (member: Omit<DBAccountTeamMember, "id" | "createdAt">) => {
      const orgId = getActiveOrgId();
      if (member.orgId !== orgId) {
        throw new Error("RLS Isolation Violation: Tenant mismatch.");
      }
      const newMember: DBAccountTeamMember = {
        ...member,
        id: `team-${Math.random().toString(36).substring(2, 11)}`,
        createdAt: new Date(),
      };
      store.accountTeams.push(newMember);
      return newMember;
    },
    addOrUpdateMember: async (
      accountId: string,
      userId: string,
      role: string,
    ) => {
      const orgId = getActiveOrgId();
      // Verify account belongs to organization
      const account = store.accounts.find((a) => a.id === accountId);
      if (!account || account.orgId !== orgId) {
        throw new Error(
          "RLS Isolation Violation: Account not found or tenant mismatch.",
        );
      }
      const index = store.accountTeams.findIndex(
        (t) =>
          t.accountId === accountId && t.userId === userId && t.orgId === orgId,
      );
      if (index !== -1) {
        store.accountTeams[index] = {
          ...store.accountTeams[index],
          role,
        };
        return store.accountTeams[index];
      }
      const newMember: DBAccountTeamMember = {
        id: `team-${Math.random().toString(36).substring(2, 11)}`,
        orgId,
        accountId,
        userId,
        role,
        createdAt: new Date(),
      };
      store.accountTeams.push(newMember);
      return newMember;
    },
    removeMember: async (accountId: string, userId: string) => {
      const orgId = getActiveOrgId();
      const index = store.accountTeams.findIndex(
        (t) =>
          t.accountId === accountId && t.userId === userId && t.orgId === orgId,
      );
      if (index === -1) return;
      store.accountTeams.splice(index, 1);
    },
  },
  opportunityTeams: {
    findMany: async () => {
      const orgId = getActiveOrgId();
      return store.opportunityTeams.filter((t) => t.orgId === orgId);
    },
    findForOpportunity: async (opportunityId: string) => {
      const orgId = getActiveOrgId();
      return store.opportunityTeams.filter(
        (t) => t.opportunityId === opportunityId && t.orgId === orgId,
      );
    },
    insert: async (
      member: Omit<DBOpportunityTeamMember, "id" | "createdAt">,
    ) => {
      const orgId = getActiveOrgId();
      if (member.orgId !== orgId) {
        throw new Error("RLS Isolation Violation: Tenant mismatch.");
      }
      const newMember: DBOpportunityTeamMember = {
        ...member,
        id: `team-${Math.random().toString(36).substring(2, 11)}`,
        createdAt: new Date(),
      };
      store.opportunityTeams.push(newMember);
      return newMember;
    },
    addOrUpdateMember: async (
      opportunityId: string,
      userId: string,
      role: string,
    ) => {
      const orgId = getActiveOrgId();
      // Verify opportunity belongs to organization
      const opportunity = store.opportunities.find(
        (o) => o.id === opportunityId,
      );
      if (!opportunity || opportunity.orgId !== orgId) {
        throw new Error(
          "RLS Isolation Violation: Opportunity not found or tenant mismatch.",
        );
      }
      const index = store.opportunityTeams.findIndex(
        (t) =>
          t.opportunityId === opportunityId &&
          t.userId === userId &&
          t.orgId === orgId,
      );
      if (index !== -1) {
        store.opportunityTeams[index] = {
          ...store.opportunityTeams[index],
          role,
        };
        return store.opportunityTeams[index];
      }
      const newMember: DBOpportunityTeamMember = {
        id: `team-${Math.random().toString(36).substring(2, 11)}`,
        orgId,
        opportunityId,
        userId,
        role,
        createdAt: new Date(),
      };
      store.opportunityTeams.push(newMember);
      return newMember;
    },
    removeMember: async (opportunityId: string, userId: string) => {
      const orgId = getActiveOrgId();
      const index = store.opportunityTeams.findIndex(
        (t) =>
          t.opportunityId === opportunityId &&
          t.userId === userId &&
          t.orgId === orgId,
      );
      if (index === -1) return;
      store.opportunityTeams.splice(index, 1);
    },
  },
  leadScoringRules: {
    findMany: async () => {
      const orgId = getActiveOrgId();
      return store.leadScoringRules.filter((r) => r.orgId === orgId);
    },
    findOne: async (id: string) => {
      const orgId = getActiveOrgId();
      const r = store.leadScoringRules.find((x) => x.id === id);
      if (r && r.orgId !== orgId) {
        return null;
      }
      return r || null;
    },
    insert: async (r: Omit<DBLeadScoringRule, "id" | "createdAt">) => {
      const orgId = getActiveOrgId();
      if (r.orgId !== orgId) {
        throw new Error("RLS Isolation Violation: Tenant mismatch.");
      }
      const newRule: DBLeadScoringRule = {
        ...r,
        id: `rule-${Math.random().toString(36).substring(2, 11)}`,
        createdAt: new Date(),
      };
      store.leadScoringRules.push(newRule);
      return newRule;
    },
    update: async (
      id: string,
      updates: Partial<Omit<DBLeadScoringRule, "id" | "orgId" | "createdAt">>,
    ) => {
      const orgId = getActiveOrgId();
      const index = store.leadScoringRules.findIndex((r) => r.id === id);
      if (index === -1) return null;
      if (store.leadScoringRules[index].orgId !== orgId) {
        throw new Error("RLS Isolation Violation: Tenant mismatch.");
      }
      store.leadScoringRules[index] = {
        ...store.leadScoringRules[index],
        ...updates,
      };
      return store.leadScoringRules[index];
    },
    delete: async (id: string) => {
      const orgId = getActiveOrgId();
      const index = store.leadScoringRules.findIndex((r) => r.id === id);
      if (index === -1) return false;
      if (store.leadScoringRules[index].orgId !== orgId) {
        throw new Error("RLS Isolation Violation: Tenant mismatch.");
      }
      store.leadScoringRules.splice(index, 1);
      return true;
    },
  },
  opportunityCompetitors: {
    findMany: async () => {
      const orgId = getActiveOrgId();
      return store.opportunityCompetitors.filter((c) => c.orgId === orgId);
    },
    findOne: async (id: string) => {
      const orgId = getActiveOrgId();
      const comp = store.opportunityCompetitors.find((c) => c.id === id);
      if (comp && comp.orgId !== orgId) {
        return null;
      }
      return comp || null;
    },
    insert: async (comp: Omit<DBOpportunityCompetitor, "id" | "createdAt">) => {
      const orgId = getActiveOrgId();
      if (comp.orgId !== orgId) {
        throw new Error("RLS Isolation Violation: Tenant mismatch.");
      }
      const newComp: DBOpportunityCompetitor = {
        ...comp,
        id: Math.random().toString(36).substring(2, 9),
        createdAt: new Date(),
      };
      store.opportunityCompetitors.push(newComp);
      return newComp;
    },
    update: async (
      id: string,
      updates: Partial<
        Omit<DBOpportunityCompetitor, "id" | "orgId" | "createdAt">
      >,
    ) => {
      const orgId = getActiveOrgId();
      const index = store.opportunityCompetitors.findIndex((c) => c.id === id);
      if (index === -1) {
        return null;
      }
      if (store.opportunityCompetitors[index].orgId !== orgId) {
        throw new Error("RLS Isolation Violation: Tenant mismatch.");
      }
      store.opportunityCompetitors[index] = {
        ...store.opportunityCompetitors[index],
        ...updates,
      };
      return store.opportunityCompetitors[index];
    },
    delete: async (id: string) => {
      const orgId = getActiveOrgId();
      const index = store.opportunityCompetitors.findIndex((c) => c.id === id);
      if (index === -1) {
        return false;
      }
      if (store.opportunityCompetitors[index].orgId !== orgId) {
        throw new Error("RLS Isolation Violation: Tenant mismatch.");
      }
      store.opportunityCompetitors.splice(index, 1);
      return true;
    },
  },
  leadConversionMappings: {
    findMany: async () => {
      const orgId = getActiveOrgId();
      return store.leadConversionMappings.filter((m) => m.orgId === orgId);
    },
    findOne: async (id: string) => {
      const orgId = getActiveOrgId();
      const mapping = store.leadConversionMappings.find((m) => m.id === id);
      if (mapping && mapping.orgId !== orgId) {
        return null;
      }
      return mapping || null;
    },
    insert: async (
      mapping: Omit<DBLeadConversionMapping, "id" | "createdAt">,
    ) => {
      const orgId = getActiveOrgId();
      if (mapping.orgId !== orgId) {
        throw new Error("RLS Isolation Violation: Tenant mismatch.");
      }
      const newMapping: DBLeadConversionMapping = {
        ...mapping,
        id: `mapping-${Math.random().toString(36).substring(2, 11)}`,
        createdAt: new Date(),
      };
      store.leadConversionMappings.push(newMapping);
      return newMapping;
    },
    delete: async (id: string) => {
      const orgId = getActiveOrgId();
      const index = store.leadConversionMappings.findIndex((m) => m.id === id);
      if (index === -1) return false;
      if (store.leadConversionMappings[index].orgId !== orgId) {
        throw new Error("RLS Isolation Violation: Tenant mismatch.");
      }
      store.leadConversionMappings.splice(index, 1);
      return true;
    },
  },
  currencies: {
    findMany: async () => {
      const orgId = getActiveOrgId();
      return store.currencies.filter((c) => c.orgId === orgId);
    },
    findOne: async (id: string) => {
      const orgId = getActiveOrgId();
      const c = store.currencies.find((x) => x.id === id);
      if (c && c.orgId !== orgId) {
        return null;
      }
      return c || null;
    },
    findByIsoCode: async (isoCode: string) => {
      const orgId = getActiveOrgId();
      const c = store.currencies.find(
        (x) =>
          x.isoCode.toLowerCase() === isoCode.toLowerCase() &&
          x.orgId === orgId,
      );
      return c || null;
    },
    insert: async (c: Omit<DBCurrency, "id" | "createdAt" | "updatedAt">) => {
      const orgId = getActiveOrgId();
      if (c.orgId !== orgId) {
        throw new Error("RLS Isolation Violation: Tenant mismatch.");
      }
      const newCurrency: DBCurrency = {
        ...c,
        id: `currency-${Math.random().toString(36).substring(2, 11)}`,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      store.currencies.push(newCurrency);
      return newCurrency;
    },
    update: async (
      id: string,
      updates: Partial<
        Omit<DBCurrency, "id" | "orgId" | "createdAt" | "updatedAt">
      >,
    ) => {
      const orgId = getActiveOrgId();
      const index = store.currencies.findIndex((c) => c.id === id);
      if (index === -1) return null;
      if (store.currencies[index].orgId !== orgId) {
        throw new Error("RLS Isolation Violation: Tenant mismatch.");
      }
      store.currencies[index] = {
        ...store.currencies[index],
        ...updates,
        updatedAt: new Date(),
      };
      return store.currencies[index];
    },
  },
  opportunityStageGates: {
    findMany: async () => {
      const orgId = getActiveOrgId();
      return store.opportunityStageGates.filter((g) => g.orgId === orgId);
    },
    findOne: async (id: string) => {
      const orgId = getActiveOrgId();
      const g = store.opportunityStageGates.find((x) => x.id === id);
      if (g && g.orgId !== orgId) {
        return null;
      }
      return g || null;
    },
    insert: async (
      g: Omit<DBOpportunityStageGate, "id" | "createdAt" | "updatedAt">,
    ) => {
      const orgId = getActiveOrgId();
      if (g.orgId !== orgId) {
        throw new Error("RLS Isolation Violation: Tenant mismatch.");
      }
      const newGate: DBOpportunityStageGate = {
        ...g,
        id: `gate-${Math.random().toString(36).substring(2, 11)}`,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      store.opportunityStageGates.push(newGate);
      return newGate;
    },
    update: async (
      id: string,
      updates: Partial<
        Omit<DBOpportunityStageGate, "id" | "orgId" | "createdAt" | "updatedAt">
      >,
    ) => {
      const orgId = getActiveOrgId();
      const index = store.opportunityStageGates.findIndex((x) => x.id === id);
      if (index === -1) return null;
      if (store.opportunityStageGates[index].orgId !== orgId) {
        throw new Error("RLS Isolation Violation: Tenant mismatch.");
      }
      store.opportunityStageGates[index] = {
        ...store.opportunityStageGates[index],
        ...updates,
        updatedAt: new Date(),
      };
      return store.opportunityStageGates[index];
    },
    delete: async (id: string) => {
      const orgId = getActiveOrgId();
      const index = store.opportunityStageGates.findIndex((x) => x.id === id);
      if (index === -1) return false;
      if (store.opportunityStageGates[index].orgId !== orgId) {
        throw new Error("RLS Isolation Violation: Tenant mismatch.");
      }
      store.opportunityStageGates.splice(index, 1);
      return true;
    },
  },
  stageGuidance: {
    findMany: async () => {
      const orgId = getActiveOrgId();
      return store.stageGuidance.filter((g) => g.orgId === orgId);
    },
    findOne: async (id: string) => {
      const orgId = getActiveOrgId();
      const g = store.stageGuidance.find((x) => x.id === id);
      if (g && g.orgId !== orgId) {
        return null;
      }
      return g || null;
    },
    insert: async (
      g: Omit<DBStageGuidance, "id" | "createdAt" | "updatedAt">,
    ) => {
      const orgId = getActiveOrgId();
      if (g.orgId !== orgId) {
        throw new Error("RLS Isolation Violation: Tenant mismatch.");
      }
      const newGuidance: DBStageGuidance = {
        ...g,
        id: `guidance-${Math.random().toString(36).substring(2, 11)}`,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      store.stageGuidance.push(newGuidance);
      return newGuidance;
    },
    update: async (
      id: string,
      updates: Partial<
        Omit<DBStageGuidance, "id" | "orgId" | "createdAt" | "updatedAt">
      >,
    ) => {
      const orgId = getActiveOrgId();
      const index = store.stageGuidance.findIndex((x) => x.id === id);
      if (index === -1) return null;
      if (store.stageGuidance[index].orgId !== orgId) {
        throw new Error("RLS Isolation Violation: Tenant mismatch.");
      }
      store.stageGuidance[index] = {
        ...store.stageGuidance[index],
        ...updates,
        updatedAt: new Date(),
      };
      return store.stageGuidance[index];
    },
    delete: async (id: string) => {
      const orgId = getActiveOrgId();
      const index = store.stageGuidance.findIndex((x) => x.id === id);
      if (index === -1) return false;
      if (store.stageGuidance[index].orgId !== orgId) {
        throw new Error("RLS Isolation Violation: Tenant mismatch.");
      }
      store.stageGuidance.splice(index, 1);
      return true;
    },
  },
  opportunityProductSchedules: {
    findForProduct: async (opportunityProductId: string) => {
      const orgId = getActiveOrgId();
      return store.opportunityProductSchedules.filter(
        (s) =>
          s.opportunityProductId === opportunityProductId && s.orgId === orgId,
      );
    },
    findOne: async (id: string) => {
      const orgId = getActiveOrgId();
      const s = store.opportunityProductSchedules.find((x) => x.id === id);
      if (s && s.orgId !== orgId) {
        return null;
      }
      return s || null;
    },
    insert: async (
      s: Omit<DBOpportunityProductSchedule, "id" | "createdAt">,
    ) => {
      const orgId = getActiveOrgId();
      if (s.orgId !== orgId) {
        throw new Error("RLS Isolation Violation: Tenant mismatch.");
      }
      const newSchedule: DBOpportunityProductSchedule = {
        ...s,
        id: `schedule-${Math.random().toString(36).substring(2, 11)}`,
        createdAt: new Date(),
      };
      store.opportunityProductSchedules.push(newSchedule);
      return newSchedule;
    },
    delete: async (id: string) => {
      const orgId = getActiveOrgId();
      const index = store.opportunityProductSchedules.findIndex(
        (s) => s.id === id,
      );
      if (index === -1) return false;
      if (store.opportunityProductSchedules[index].orgId !== orgId) {
        throw new Error("RLS Isolation Violation: Tenant mismatch.");
      }
      store.opportunityProductSchedules.splice(index, 1);
      return true;
    },
    deleteForProduct: async (opportunityProductId: string) => {
      const orgId = getActiveOrgId();
      // Safe filter/mutation under RLS
      const targets = store.opportunityProductSchedules.filter(
        (s) =>
          s.opportunityProductId === opportunityProductId && s.orgId === orgId,
      );
      for (const t of targets) {
        const idx = store.opportunityProductSchedules.findIndex(
          (s) => s.id === t.id,
        );
        if (idx !== -1) {
          store.opportunityProductSchedules.splice(idx, 1);
        }
      }
      return true;
    },
  },
  leadAutoConversionRules: {
    findMany: async () => {
      const orgId = getActiveOrgId();
      return store.leadAutoConversionRules.filter((r) => r.orgId === orgId);
    },
    findOne: async (id: string) => {
      const orgId = getActiveOrgId();
      const r = store.leadAutoConversionRules.find((x) => x.id === id);
      if (r && r.orgId !== orgId) return null;
      return r || null;
    },
    insert: async (
      rule: Omit<DBLeadAutoConversionRule, "id" | "createdAt">,
    ) => {
      const orgId = getActiveOrgId();
      if (rule.orgId !== orgId) {
        throw new Error("RLS Isolation Violation: Tenant mismatch.");
      }
      const newRule: DBLeadAutoConversionRule = {
        ...rule,
        id: `conversion-rule-${Math.random().toString(36).substring(2, 11)}`,
        createdAt: new Date(),
      };
      store.leadAutoConversionRules.push(newRule);
      return newRule;
    },
    update: async (
      id: string,
      updates: Partial<
        Omit<DBLeadAutoConversionRule, "id" | "orgId" | "createdAt">
      >,
    ) => {
      const orgId = getActiveOrgId();
      const index = store.leadAutoConversionRules.findIndex((r) => r.id === id);
      if (index === -1) return null;
      if (store.leadAutoConversionRules[index].orgId !== orgId) {
        throw new Error("RLS Isolation Violation: Tenant mismatch.");
      }
      store.leadAutoConversionRules[index] = {
        ...store.leadAutoConversionRules[index],
        ...updates,
      };
      return store.leadAutoConversionRules[index];
    },
  },
  opportunityStageDurationRules: {
    findMany: async () => {
      const orgId = getActiveOrgId();
      return store.opportunityStageDurationRules.filter(
        (r) => r.orgId === orgId,
      );
    },
    findByStage: async (stage: string) => {
      const orgId = getActiveOrgId();
      const r = store.opportunityStageDurationRules.find(
        (x) => x.stage === stage && x.orgId === orgId,
      );
      return r || null;
    },
    upsert: async (
      rule: Omit<
        DBOpportunityStageDurationRule,
        "id" | "createdAt" | "updatedAt"
      >,
    ) => {
      const orgId = getActiveOrgId();
      if (rule.orgId !== orgId) {
        throw new Error("RLS Isolation Violation: Tenant mismatch.");
      }
      const existingIndex = store.opportunityStageDurationRules.findIndex(
        (x) => x.stage === rule.stage && x.orgId === orgId,
      );
      const now = new Date();
      if (existingIndex > -1) {
        store.opportunityStageDurationRules[existingIndex] = {
          ...store.opportunityStageDurationRules[existingIndex],
          maxDaysAllowed: rule.maxDaysAllowed,
          updatedAt: now,
        };
        return store.opportunityStageDurationRules[existingIndex];
      }
      const newRule: DBOpportunityStageDurationRule = {
        ...rule,
        id: `duration-rule-${Math.random().toString(36).substring(2, 11)}`,
        createdAt: now,
        updatedAt: now,
      };
      store.opportunityStageDurationRules.push(newRule);
      return newRule;
    },
  },
  contactConsentPreferences: {
    findMany: async (recordType?: "lead" | "contact", recordId?: string) => {
      const orgId = getActiveOrgId();
      return store.contactConsentPreferences.filter(
        (p) =>
          p.orgId === orgId &&
          (!recordType || p.recordType === recordType) &&
          (!recordId || p.recordId === recordId),
      );
    },
    upsert: async (
      preference: Omit<
        DBContactConsentPreference,
        "id" | "createdAt" | "updatedAt"
      >,
    ) => {
      const orgId = getActiveOrgId();
      if (preference.orgId !== orgId) {
        throw new Error("RLS Isolation Violation: Tenant mismatch.");
      }
      const existingIndex = store.contactConsentPreferences.findIndex(
        (x) =>
          x.recordType === preference.recordType &&
          x.recordId === preference.recordId &&
          x.channel === preference.channel &&
          x.orgId === orgId,
      );
      const now = new Date();
      if (existingIndex > -1) {
        store.contactConsentPreferences[existingIndex] = {
          ...store.contactConsentPreferences[existingIndex],
          status: preference.status,
          source: preference.source,
          updatedById: preference.updatedById,
          updatedAt: now,
        };
        return store.contactConsentPreferences[existingIndex];
      }
      const newPref: DBContactConsentPreference = {
        ...preference,
        id: `consent-${Math.random().toString(36).substring(2, 11)}`,
        createdAt: now,
        updatedAt: now,
      };
      store.contactConsentPreferences.push(newPref);
      return newPref;
    },
  },
  emailCalendarSyncSettings: {
    findMany: async () => {
      const orgId = getActiveOrgId();
      return store.emailCalendarSyncSettings.filter((s) => s.orgId === orgId);
    },
    findByUser: async (userId: string) => {
      const orgId = getActiveOrgId();
      return (
        store.emailCalendarSyncSettings.find(
          (s) => s.userId === userId && s.orgId === orgId,
        ) || null
      );
    },
    insert: async (
      settings: Omit<
        DBEmailCalendarSyncSettings,
        "id" | "createdAt" | "updatedAt"
      >,
    ) => {
      const orgId = getActiveOrgId();
      if (settings.orgId !== orgId) {
        throw new Error("RLS Isolation Violation: Tenant mismatch.");
      }
      const now = new Date();
      const newSettings: DBEmailCalendarSyncSettings = {
        ...settings,
        id: `settings-${Math.random().toString(36).substring(2, 11)}`,
        createdAt: now,
        updatedAt: now,
      };
      store.emailCalendarSyncSettings.push(newSettings);
      return newSettings;
    },
    update: async (
      id: string,
      updates: Partial<
        Omit<
          DBEmailCalendarSyncSettings,
          "id" | "orgId" | "userId" | "createdAt" | "updatedAt"
        >
      >,
    ) => {
      const orgId = getActiveOrgId();
      const index = store.emailCalendarSyncSettings.findIndex(
        (s) => s.id === id,
      );
      if (index === -1) return null;
      if (store.emailCalendarSyncSettings[index].orgId !== orgId) {
        throw new Error("RLS Isolation Violation: Tenant mismatch.");
      }
      store.emailCalendarSyncSettings[index] = {
        ...store.emailCalendarSyncSettings[index],
        ...updates,
        updatedAt: new Date(),
      };
      return store.emailCalendarSyncSettings[index];
    },
  },
  emailCalendarSyncRuns: {
    findMany: async () => {
      const orgId = getActiveOrgId();
      return store.emailCalendarSyncRuns.filter((r) => r.orgId === orgId);
    },
    insert: async (run: Omit<DBEmailCalendarSyncRun, "id">) => {
      const orgId = getActiveOrgId();
      if (run.orgId !== orgId) {
        throw new Error("RLS Isolation Violation: Tenant mismatch.");
      }
      const newRun: DBEmailCalendarSyncRun = {
        ...run,
        id: `run-${Math.random().toString(36).substring(2, 11)}`,
      };
      store.emailCalendarSyncRuns.push(newRun);
      return newRun;
    },
  },
  esignatureRequests: {
    findMany: async () => {
      const orgId = getActiveOrgId();
      return store.esignatureRequests.filter((r) => r.orgId === orgId);
    },
    findOne: async (id: string) => {
      const orgId = getActiveOrgId();
      const req = store.esignatureRequests.find((r) => r.id === id);
      if (req && req.orgId !== orgId) {
        return null;
      }
      return req || null;
    },
    insert: async (
      req: Omit<DBEsignatureRequest, "id" | "sentAt" | "completedAt"> & {
        sentAt?: Date;
        completedAt?: Date | null;
      },
    ) => {
      const orgId = getActiveOrgId();
      if (req.orgId !== orgId) {
        throw new Error("RLS Isolation Violation: Tenant mismatch.");
      }
      const newReq: DBEsignatureRequest = {
        ...req,
        id: `esign-${Math.random().toString(36).substring(2, 11)}`,
        sentAt: req.sentAt || new Date(),
        completedAt: req.completedAt || null,
      };
      store.esignatureRequests.push(newReq);
      return newReq;
    },
    update: async (
      id: string,
      updates: Partial<Omit<DBEsignatureRequest, "id" | "orgId">>,
    ) => {
      const orgId = getActiveOrgId();
      const index = store.esignatureRequests.findIndex((r) => r.id === id);
      if (index === -1) return null;
      if (store.esignatureRequests[index].orgId !== orgId) {
        throw new Error("RLS Isolation Violation: Tenant mismatch.");
      }
      store.esignatureRequests[index] = {
        ...store.esignatureRequests[index],
        ...updates,
      };
      return store.esignatureRequests[index];
    },
  },
  surveys: {
    findMany: async () => {
      const orgId = getActiveOrgId();
      return store.surveys.filter((s) => s.orgId === orgId);
    },
    findOne: async (id: string) => {
      const orgId = getActiveOrgId();
      const survey = store.surveys.find((s) => s.id === id);
      if (survey && survey.orgId !== orgId) {
        return null;
      }
      return survey || null;
    },
    insert: async (
      survey: Omit<DBSurvey, "id" | "createdAt"> & {
        createdAt?: Date;
      },
    ) => {
      const orgId = getActiveOrgId();
      if (survey.orgId !== orgId) {
        throw new Error("RLS Isolation Violation: Tenant mismatch.");
      }
      const newSurvey: DBSurvey = {
        ...survey,
        id: `survey-${Math.random().toString(36).substring(2, 11)}`,
        createdAt: survey.createdAt || new Date(),
      };
      store.surveys.push(newSurvey);
      return newSurvey;
    },
    update: async (
      id: string,
      updates: Partial<Omit<DBSurvey, "id" | "orgId">>,
    ) => {
      const orgId = getActiveOrgId();
      const index = store.surveys.findIndex((s) => s.id === id);
      if (index === -1) return null;
      if (store.surveys[index].orgId !== orgId) {
        throw new Error("RLS Isolation Violation: Tenant mismatch.");
      }
      store.surveys[index] = {
        ...store.surveys[index],
        ...updates,
      };
      return store.surveys[index];
    },
  },
  surveyResponses: {
    findMany: async () => {
      const orgId = getActiveOrgId();
      return store.surveyResponses.filter((r) => r.orgId === orgId);
    },
    findBySurvey: async (surveyId: string) => {
      const orgId = getActiveOrgId();
      return store.surveyResponses.filter(
        (r) => r.surveyId === surveyId && r.orgId === orgId,
      );
    },
    findByTicket: async (ticketId: string) => {
      const orgId = getActiveOrgId();
      return store.surveyResponses.filter(
        (r) => r.ticketId === ticketId && r.orgId === orgId,
      );
    },
    insert: async (
      res: Omit<DBSurveyResponse, "id" | "createdAt"> & {
        createdAt?: Date;
      },
    ) => {
      const orgId = getActiveOrgId();
      if (res.orgId !== orgId) {
        throw new Error("RLS Isolation Violation: Tenant mismatch.");
      }
      const newRes: DBSurveyResponse = {
        ...res,
        ticketId: res.ticketId || null,
        id: `sres-${Math.random().toString(36).substring(2, 11)}`,
        createdAt: res.createdAt || new Date(),
      };
      store.surveyResponses.push(newRes);
      return newRes;
    },
  },
  slaPolicies: {
    findMany: async () => {
      const orgId = getActiveOrgId();
      return store.slaPolicies.filter((p) => p.orgId === orgId);
    },
    findOne: async (id: string) => {
      const orgId = getActiveOrgId();
      const policy = store.slaPolicies.find((p) => p.id === id);
      if (policy && policy.orgId !== orgId) {
        return null;
      }
      return policy || null;
    },
    insert: async (
      policy: Omit<DBSlaPolicy, "id" | "createdAt"> & {
        createdAt?: Date;
      },
    ) => {
      const orgId = getActiveOrgId();
      if (policy.orgId !== orgId) {
        throw new Error("RLS Isolation Violation: Tenant mismatch.");
      }
      const newPolicy: DBSlaPolicy = {
        ...policy,
        id: `sla-${Math.random().toString(36).substring(2, 11)}`,
        createdAt: policy.createdAt || new Date(),
      };
      store.slaPolicies.push(newPolicy);
      return newPolicy;
    },
    update: async (
      id: string,
      updates: Partial<Omit<DBSlaPolicy, "id" | "orgId" | "createdAt">>,
    ) => {
      const orgId = getActiveOrgId();
      const index = store.slaPolicies.findIndex((p) => p.id === id);
      if (index === -1) return null;
      if (store.slaPolicies[index].orgId !== orgId) {
        throw new Error("RLS Isolation Violation: Tenant mismatch.");
      }
      store.slaPolicies[index] = {
        ...store.slaPolicies[index],
        ...updates,
      };
      return store.slaPolicies[index];
    },
  },
  ticketMilestones: {
    findMany: async () => {
      const orgId = getActiveOrgId();
      return store.ticketMilestones.filter((m) => m.orgId === orgId);
    },
    findByTicket: async (ticketId: string) => {
      const orgId = getActiveOrgId();
      return store.ticketMilestones.filter(
        (m) => m.ticketId === ticketId && m.orgId === orgId,
      );
    },
    findOne: async (id: string) => {
      const orgId = getActiveOrgId();
      const milestone = store.ticketMilestones.find((m) => m.id === id);
      if (milestone && milestone.orgId !== orgId) {
        return null;
      }
      return milestone || null;
    },
    insert: async (
      milestone: Omit<DBTicketMilestone, "id" | "createdAt"> & {
        createdAt?: Date;
      },
    ) => {
      const orgId = getActiveOrgId();
      if (milestone.orgId !== orgId) {
        throw new Error("RLS Isolation Violation: Tenant mismatch.");
      }
      const newMilestone: DBTicketMilestone = {
        ...milestone,
        id: `milestone-${Math.random().toString(36).substring(2, 11)}`,
        createdAt: milestone.createdAt || new Date(),
      };
      store.ticketMilestones.push(newMilestone);
      return newMilestone;
    },
    update: async (
      id: string,
      updates: Partial<Omit<DBTicketMilestone, "id" | "orgId" | "createdAt">>,
    ) => {
      const orgId = getActiveOrgId();
      const index = store.ticketMilestones.findIndex((m) => m.id === id);
      if (index === -1) return null;
      if (store.ticketMilestones[index].orgId !== orgId) {
        throw new Error("RLS Isolation Violation: Tenant mismatch.");
      }
      store.ticketMilestones[index] = {
        ...store.ticketMilestones[index],
        ...updates,
      };
      return store.ticketMilestones[index];
    },
  },
  kbCategories: {
    findMany: async () => {
      const orgId = getActiveOrgId();
      return store.kbCategories.filter((c) => c.orgId === orgId);
    },
    findOne: async (id: string) => {
      const orgId = getActiveOrgId();
      const category = store.kbCategories.find((c) => c.id === id);
      if (category && category.orgId !== orgId) {
        return null;
      }
      return category || null;
    },
    insert: async (
      category: Omit<DBKbCategory, "id" | "createdAt"> & {
        createdAt?: Date;
      },
    ) => {
      const orgId = getActiveOrgId();
      if (category.orgId !== orgId) {
        throw new Error("RLS Isolation Violation: Tenant mismatch.");
      }
      const newCategory: DBKbCategory = {
        ...category,
        id: `kbcat-${Math.random().toString(36).substring(2, 11)}`,
        createdAt: category.createdAt || new Date(),
      };
      store.kbCategories.push(newCategory);
      return newCategory;
    },
  },
  kbArticles: {
    findMany: async () => {
      const orgId = getActiveOrgId();
      return store.kbArticles.filter((a) => a.orgId === orgId);
    },
    findOne: async (id: string) => {
      const orgId = getActiveOrgId();
      const article = store.kbArticles.find((a) => a.id === id);
      if (article && article.orgId !== orgId) {
        return null;
      }
      return article || null;
    },
    insert: async (
      article: Omit<DBKbArticle, "id" | "createdAt" | "viewCount"> & {
        createdAt?: Date;
        viewCount?: number;
      },
    ) => {
      const orgId = getActiveOrgId();
      if (article.orgId !== orgId) {
        throw new Error("RLS Isolation Violation: Tenant mismatch.");
      }
      const newArticle: DBKbArticle = {
        ...article,
        id: `kbart-${Math.random().toString(36).substring(2, 11)}`,
        viewCount: article.viewCount || 0,
        createdAt: article.createdAt || new Date(),
      };
      store.kbArticles.push(newArticle);
      return newArticle;
    },
    update: async (
      id: string,
      updates: Partial<Omit<DBKbArticle, "id" | "orgId" | "createdAt">>,
    ) => {
      const orgId = getActiveOrgId();
      const index = store.kbArticles.findIndex((a) => a.id === id);
      if (index === -1) return null;
      if (store.kbArticles[index].orgId !== orgId) {
        throw new Error("RLS Isolation Violation: Tenant mismatch.");
      }
      store.kbArticles[index] = {
        ...store.kbArticles[index],
        ...updates,
      };
      return store.kbArticles[index];
    },
  },
  ticketComments: {
    findMany: async () => {
      const orgId = getActiveOrgId();
      return store.ticketComments.filter((c) => c.orgId === orgId);
    },
    findOne: async (id: string) => {
      const orgId = getActiveOrgId();
      const comment = store.ticketComments.find((c) => c.id === id);
      if (comment && comment.orgId !== orgId) {
        return null;
      }
      return comment || null;
    },
    insert: async (
      comment: Omit<DBTicketComment, "id" | "createdAt"> & {
        createdAt?: Date;
      },
    ) => {
      const orgId = getActiveOrgId();
      if (comment.orgId !== orgId) {
        throw new Error("RLS Isolation Violation: Tenant mismatch.");
      }
      const newComment: DBTicketComment = {
        ...comment,
        id: `tcom-${Math.random().toString(36).substring(2, 11)}`,
        createdAt: comment.createdAt || new Date(),
      };
      store.ticketComments.push(newComment);
      return newComment;
    },
  },
  ticketTags: {
    findMany: async () => {
      const orgId = getActiveOrgId();
      return store.ticketTags.filter((t) => t.orgId === orgId);
    },
    findOne: async (id: string) => {
      const orgId = getActiveOrgId();
      const tag = store.ticketTags.find((t) => t.id === id);
      if (tag && tag.orgId !== orgId) {
        return null;
      }
      return tag || null;
    },
    insert: async (
      tag: Omit<DBTicketTag, "id" | "createdAt"> & {
        createdAt?: Date;
      },
    ) => {
      const orgId = getActiveOrgId();
      if (tag.orgId !== orgId) {
        throw new Error("RLS Isolation Violation: Tenant mismatch.");
      }
      const newTag: DBTicketTag = {
        ...tag,
        id: `ttag-${Math.random().toString(36).substring(2, 11)}`,
        createdAt: tag.createdAt || new Date(),
      };
      store.ticketTags.push(newTag);
      return newTag;
    },
  },
  ticketTagLinks: {
    findMany: async () => {
      const orgId = getActiveOrgId();
      return store.ticketTagLinks.filter((l) => l.orgId === orgId);
    },
    findOne: async (id: string) => {
      const orgId = getActiveOrgId();
      const link = store.ticketTagLinks.find((l) => l.id === id);
      if (link && link.orgId !== orgId) {
        return null;
      }
      return link || null;
    },
    insert: async (
      link: Omit<DBTicketTagLink, "id" | "createdAt"> & {
        createdAt?: Date;
      },
    ) => {
      const orgId = getActiveOrgId();
      if (link.orgId !== orgId) {
        throw new Error("RLS Isolation Violation: Tenant mismatch.");
      }
      const newLink: DBTicketTagLink = {
        ...link,
        id: `tlink-${Math.random().toString(36).substring(2, 11)}`,
        createdAt: link.createdAt || new Date(),
      };
      store.ticketTagLinks.push(newLink);
      return newLink;
    },
    delete: async (id: string) => {
      const orgId = getActiveOrgId();
      const index = store.ticketTagLinks.findIndex((l) => l.id === id);
      if (index === -1) return false;
      if (store.ticketTagLinks[index].orgId !== orgId) {
        throw new Error("RLS Isolation Violation: Tenant mismatch.");
      }
      store.ticketTagLinks.splice(index, 1);
      return true;
    },
  },
  ticketAssignmentRules: {
    findMany: async () => {
      const orgId = getActiveOrgId();
      return store.ticketAssignmentRules.filter((r) => r.orgId === orgId);
    },
    findOne: async (id: string) => {
      const orgId = getActiveOrgId();
      const rule = store.ticketAssignmentRules.find((r) => r.id === id);
      if (rule && rule.orgId !== orgId) {
        return null;
      }
      return rule || null;
    },
    insert: async (
      rule: Omit<DBTicketAssignmentRule, "id" | "createdAt"> & {
        createdAt?: Date;
      },
    ) => {
      const orgId = getActiveOrgId();
      if (rule.orgId !== orgId) {
        throw new Error("RLS Isolation Violation: Tenant mismatch.");
      }
      const newRule: DBTicketAssignmentRule = {
        ...rule,
        id: `trule-${Math.random().toString(36).substring(2, 11)}`,
        createdAt: rule.createdAt || new Date(),
      };
      store.ticketAssignmentRules.push(newRule);
      return newRule;
    },
    update: async (
      id: string,
      updates: Partial<
        Omit<DBTicketAssignmentRule, "id" | "orgId" | "createdAt">
      >,
    ) => {
      const orgId = getActiveOrgId();
      const index = store.ticketAssignmentRules.findIndex((r) => r.id === id);
      if (index === -1) return null;
      if (store.ticketAssignmentRules[index].orgId !== orgId) {
        throw new Error("RLS Isolation Violation: Tenant mismatch.");
      }
      store.ticketAssignmentRules[index] = {
        ...store.ticketAssignmentRules[index],
        ...updates,
      };
      return store.ticketAssignmentRules[index];
    },
  },
  ticketAssignmentRuleEntries: {
    findMany: async () => {
      const orgId = getActiveOrgId();
      return store.ticketAssignmentRuleEntries.filter((e) => e.orgId === orgId);
    },
    findOne: async (id: string) => {
      const orgId = getActiveOrgId();
      const entry = store.ticketAssignmentRuleEntries.find((e) => e.id === id);
      if (entry && entry.orgId !== orgId) {
        return null;
      }
      return entry || null;
    },
    insert: async (entry: Omit<DBTicketAssignmentRuleEntry, "id">) => {
      const orgId = getActiveOrgId();
      if (entry.orgId !== orgId) {
        throw new Error("RLS Isolation Violation: Tenant mismatch.");
      }
      const newEntry: DBTicketAssignmentRuleEntry = {
        ...entry,
        id: `trent-${Math.random().toString(36).substring(2, 11)}`,
      };
      store.ticketAssignmentRuleEntries.push(newEntry);
      return newEntry;
    },
    update: async (
      id: string,
      updates: Partial<
        Omit<DBTicketAssignmentRuleEntry, "id" | "orgId" | "ruleId">
      >,
    ) => {
      const orgId = getActiveOrgId();
      const index = store.ticketAssignmentRuleEntries.findIndex(
        (e) => e.id === id,
      );
      if (index === -1) return null;
      if (store.ticketAssignmentRuleEntries[index].orgId !== orgId) {
        throw new Error("RLS Isolation Violation: Tenant mismatch.");
      }
      store.ticketAssignmentRuleEntries[index] = {
        ...store.ticketAssignmentRuleEntries[index],
        ...updates,
      };
      return store.ticketAssignmentRuleEntries[index];
    },
  },
  ticketEscalationRules: {
    findMany: async () => {
      const orgId = getActiveOrgId();
      return store.ticketEscalationRules.filter((r) => r.orgId === orgId);
    },
    findOne: async (id: string) => {
      const orgId = getActiveOrgId();
      const rule = store.ticketEscalationRules.find((r) => r.id === id);
      if (rule && rule.orgId !== orgId) {
        return null;
      }
      return rule || null;
    },
    insert: async (
      rule: Omit<DBTicketEscalationRule, "id" | "createdAt"> & {
        createdAt?: Date;
      },
    ) => {
      const orgId = getActiveOrgId();
      if (rule.orgId !== orgId) {
        throw new Error("RLS Isolation Violation: Tenant mismatch.");
      }
      const newRule: DBTicketEscalationRule = {
        ...rule,
        id: `tescr-${Math.random().toString(36).substring(2, 11)}`,
        createdAt: rule.createdAt || new Date(),
      };
      store.ticketEscalationRules.push(newRule);
      return newRule;
    },
    update: async (
      id: string,
      updates: Partial<
        Omit<DBTicketEscalationRule, "id" | "orgId" | "createdAt">
      >,
    ) => {
      const orgId = getActiveOrgId();
      const index = store.ticketEscalationRules.findIndex((r) => r.id === id);
      if (index === -1) return null;
      if (store.ticketEscalationRules[index].orgId !== orgId) {
        throw new Error("RLS Isolation Violation: Tenant mismatch.");
      }
      store.ticketEscalationRules[index] = {
        ...store.ticketEscalationRules[index],
        ...updates,
      };
      return store.ticketEscalationRules[index];
    },
  },
  ticketEscalations: {
    findMany: async () => {
      const orgId = getActiveOrgId();
      return store.ticketEscalations.filter((e) => e.orgId === orgId);
    },
    findOne: async (id: string) => {
      const orgId = getActiveOrgId();
      const escalation = store.ticketEscalations.find((e) => e.id === id);
      if (escalation && escalation.orgId !== orgId) {
        return null;
      }
      return escalation || null;
    },
    insert: async (
      escalation: Omit<DBTicketEscalation, "id" | "createdAt"> & {
        createdAt?: Date;
      },
    ) => {
      const orgId = getActiveOrgId();
      if (escalation.orgId !== orgId) {
        throw new Error("RLS Isolation Violation: Tenant mismatch.");
      }
      const newEscalation: DBTicketEscalation = {
        ...escalation,
        id: `tesc-${Math.random().toString(36).substring(2, 11)}`,
        createdAt: escalation.createdAt || new Date(),
      };
      store.ticketEscalations.push(newEscalation);
      return newEscalation;
    },
  },
  ticketMacros: {
    findMany: async () => {
      const orgId = getActiveOrgId();
      return store.ticketMacros.filter((m) => m.orgId === orgId);
    },
    findOne: async (id: string) => {
      const orgId = getActiveOrgId();
      const macro = store.ticketMacros.find((m) => m.id === id);
      if (macro && macro.orgId !== orgId) {
        return null;
      }
      return macro || null;
    },
    insert: async (
      macro: Omit<DBTicketMacro, "id" | "createdAt"> & {
        createdAt?: Date;
      },
    ) => {
      const orgId = getActiveOrgId();
      if (macro.orgId !== orgId) {
        throw new Error("RLS Isolation Violation: Tenant mismatch.");
      }
      const newMacro: DBTicketMacro = {
        ...macro,
        id: `tmac-${Math.random().toString(36).substring(2, 11)}`,
        createdAt: macro.createdAt || new Date(),
      };
      store.ticketMacros.push(newMacro);
      return newMacro;
    },
  },
  schemaMigrations: {
    findMany: async () => {
      const orgId = getActiveOrgId();
      return store.schemaMigrations.filter((m) => m.orgId === orgId);
    },
    findOne: async (id: string) => {
      const orgId = getActiveOrgId();
      const m = store.schemaMigrations.find((x) => x.id === id);
      if (m && m.orgId !== orgId) {
        return null;
      }
      return m || null;
    },
    insert: async (
      migration: Omit<DBSchemaMigration, "id" | "appliedAt"> & {
        appliedAt?: Date;
      },
    ) => {
      const orgId = getActiveOrgId();
      if (migration.orgId !== orgId) {
        throw new Error("RLS Isolation Violation: Tenant mismatch.");
      }
      const newMigration: DBSchemaMigration = {
        ...migration,
        id: `mig-${Math.random().toString(36).substring(2, 11)}`,
        appliedAt: migration.appliedAt || new Date(),
      };
      store.schemaMigrations.push(newMigration);
      return newMigration;
    },
    delete: async (id: string) => {
      const orgId = getActiveOrgId();
      const index = store.schemaMigrations.findIndex((x) => x.id === id);
      if (index === -1) return false;
      if (store.schemaMigrations[index].orgId !== orgId) {
        throw new Error("RLS Isolation Violation: Tenant mismatch.");
      }
      store.schemaMigrations.splice(index, 1);
      return true;
    },
  },
  scheduledReports: {
    findMany: async () => {
      const orgId = getActiveOrgId();
      return store.scheduledReports.filter((r) => r.orgId === orgId);
    },
    findOne: async (id: string) => {
      const orgId = getActiveOrgId();
      const r = store.scheduledReports.find((x) => x.id === id);
      if (r && r.orgId !== orgId) {
        return null;
      }
      return r || null;
    },
    insert: async (
      r: Omit<DBScheduledReport, "id" | "createdAt"> & { createdAt?: Date },
    ) => {
      const orgId = getActiveOrgId();
      if (r.orgId !== orgId) {
        throw new Error("RLS Isolation Violation: Tenant mismatch.");
      }
      const newReport: DBScheduledReport = {
        ...r,
        id: `sr-${Math.random().toString(36).substring(2, 11)}`,
        createdAt: r.createdAt || new Date(),
      };
      store.scheduledReports.push(newReport);
      return newReport;
    },
    update: async (
      id: string,
      updates: Partial<Omit<DBScheduledReport, "id" | "orgId">>,
    ) => {
      const orgId = getActiveOrgId();
      const index = store.scheduledReports.findIndex((x) => x.id === id);
      if (index === -1) return null;
      if (store.scheduledReports[index].orgId !== orgId) {
        throw new Error("RLS Isolation Violation: Tenant mismatch.");
      }
      store.scheduledReports[index] = {
        ...store.scheduledReports[index],
        ...updates,
      };
      return store.scheduledReports[index];
    },
    delete: async (id: string) => {
      const orgId = getActiveOrgId();
      const index = store.scheduledReports.findIndex((x) => x.id === id);
      if (index === -1) return false;
      if (store.scheduledReports[index].orgId !== orgId) {
        throw new Error("RLS Isolation Violation: Tenant mismatch.");
      }
      store.scheduledReports.splice(index, 1);
      return true;
    },
  },
  scheduledReportRuns: {
    findMany: async () => {
      const orgId = getActiveOrgId();
      return store.scheduledReportRuns.filter((r) => r.orgId === orgId);
    },
    findOne: async (id: string) => {
      const orgId = getActiveOrgId();
      const r = store.scheduledReportRuns.find((x) => x.id === id);
      if (r && r.orgId !== orgId) {
        return null;
      }
      return r || null;
    },
    insert: async (
      r: Omit<DBScheduledReportRun, "id" | "runAt"> & { runAt?: Date },
    ) => {
      const orgId = getActiveOrgId();
      if (r.orgId !== orgId) {
        throw new Error("RLS Isolation Violation: Tenant mismatch.");
      }
      const newRun: DBScheduledReportRun = {
        ...r,
        id: `srr-${Math.random().toString(36).substring(2, 11)}`,
        runAt: r.runAt || new Date(),
      };
      store.scheduledReportRuns.push(newRun);
      return newRun;
    },
  },
  picklistDependencies: {
    findMany: async () => {
      const orgId = getActiveOrgId();
      return store.picklistDependencies.filter((d) => d.orgId === orgId);
    },
    findOne: async (id: string) => {
      const orgId = getActiveOrgId();
      const d = store.picklistDependencies.find((x) => x.id === id);
      if (d && d.orgId !== orgId) return null;
      return d || null;
    },
    insert: async (
      d: Omit<DBPicklistDependency, "id" | "createdAt" | "updatedAt">,
    ) => {
      const orgId = getActiveOrgId();
      if (d.orgId !== orgId) {
        throw new Error("RLS Isolation Violation: Tenant mismatch.");
      }
      const newDep: DBPicklistDependency = {
        ...d,
        id: `pldep-${Math.random().toString(36).substring(2, 11)}`,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      store.picklistDependencies.push(newDep);
      return newDep;
    },
    update: async (
      id: string,
      updates: Partial<
        Omit<DBPicklistDependency, "id" | "orgId" | "createdAt" | "updatedAt">
      >,
    ) => {
      const orgId = getActiveOrgId();
      const index = store.picklistDependencies.findIndex((x) => x.id === id);
      if (index === -1) return null;
      if (store.picklistDependencies[index].orgId !== orgId) {
        throw new Error("RLS Isolation Violation: Tenant mismatch.");
      }
      store.picklistDependencies[index] = {
        ...store.picklistDependencies[index],
        ...updates,
        updatedAt: new Date(),
      };
      return store.picklistDependencies[index];
    },
    delete: async (id: string) => {
      const orgId = getActiveOrgId();
      const index = store.picklistDependencies.findIndex((x) => x.id === id);
      if (index === -1) return false;
      if (store.picklistDependencies[index].orgId !== orgId) {
        throw new Error("RLS Isolation Violation: Tenant mismatch.");
      }
      store.picklistDependencies.splice(index, 1);
      return true;
    },
  },
  validationRules: {
    findMany: async () => {
      const orgId = getActiveOrgId();
      return store.validationRules.filter((r) => r.orgId === orgId);
    },
    findOne: async (id: string) => {
      const orgId = getActiveOrgId();
      const r = store.validationRules.find((x) => x.id === id);
      if (r && r.orgId !== orgId) return null;
      return r || null;
    },
    insert: async (
      r: Omit<DBValidationRule, "id" | "createdAt" | "updatedAt">,
    ) => {
      const orgId = getActiveOrgId();
      if (r.orgId !== orgId) {
        throw new Error("RLS Isolation Violation: Tenant mismatch.");
      }
      const newRule: DBValidationRule = {
        ...r,
        id: `valrule-${Math.random().toString(36).substring(2, 11)}`,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      store.validationRules.push(newRule);
      return newRule;
    },
    update: async (
      id: string,
      updates: Partial<
        Omit<DBValidationRule, "id" | "orgId" | "createdAt" | "updatedAt">
      >,
    ) => {
      const orgId = getActiveOrgId();
      const index = store.validationRules.findIndex((x) => x.id === id);
      if (index === -1) return null;
      if (store.validationRules[index].orgId !== orgId) {
        throw new Error("RLS Isolation Violation: Tenant mismatch.");
      }
      store.validationRules[index] = {
        ...store.validationRules[index],
        ...updates,
        updatedAt: new Date(),
      };
      return store.validationRules[index];
    },
    delete: async (id: string) => {
      const orgId = getActiveOrgId();
      const index = store.validationRules.findIndex((x) => x.id === id);
      if (index === -1) return false;
      if (store.validationRules[index].orgId !== orgId) {
        throw new Error("RLS Isolation Violation: Tenant mismatch.");
      }
      store.validationRules.splice(index, 1);
      return true;
    },
  },
  emailTemplates: {
    findMany: async () => {
      const orgId = getActiveOrgId();
      return store.emailTemplates.filter((t) => t.orgId === orgId);
    },
    findOne: async (id: string) => {
      const orgId = getActiveOrgId();
      const t = store.emailTemplates.find((x) => x.id === id);
      if (t && t.orgId !== orgId) return null;
      return t || null;
    },
    insert: async (
      t: Omit<DBEmailTemplate, "id" | "createdAt" | "updatedAt">,
    ) => {
      const orgId = getActiveOrgId();
      if (t.orgId !== orgId) {
        throw new Error("RLS Isolation Violation: Tenant mismatch.");
      }
      const newTemplate: DBEmailTemplate = {
        ...t,
        id: `emailtpl-${Math.random().toString(36).substring(2, 11)}`,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      store.emailTemplates.push(newTemplate);
      return newTemplate;
    },
    update: async (
      id: string,
      updates: Partial<
        Omit<DBEmailTemplate, "id" | "orgId" | "createdAt" | "updatedAt">
      >,
    ) => {
      const orgId = getActiveOrgId();
      const index = store.emailTemplates.findIndex((x) => x.id === id);
      if (index === -1) return null;
      if (store.emailTemplates[index].orgId !== orgId) {
        throw new Error("RLS Isolation Violation: Tenant mismatch.");
      }
      store.emailTemplates[index] = {
        ...store.emailTemplates[index],
        ...updates,
        updatedAt: new Date(),
      };
      return store.emailTemplates[index];
    },
    delete: async (id: string) => {
      const orgId = getActiveOrgId();
      const index = store.emailTemplates.findIndex((x) => x.id === id);
      if (index === -1) return false;
      if (store.emailTemplates[index].orgId !== orgId) {
        throw new Error("RLS Isolation Violation: Tenant mismatch.");
      }
      store.emailTemplates.splice(index, 1);
      return true;
    },
  },
  emailTrackers: {
    findMany: async () => {
      const orgId = getActiveOrgId();
      return store.emailTrackers.filter((t) => t.orgId === orgId);
    },
    findOne: async (id: string) => {
      const orgId = getActiveOrgId();
      const t = store.emailTrackers.find((x) => x.id === id);
      if (t && t.orgId !== orgId) return null;
      return t || null;
    },
    findByToken: async (token: string) => {
      return store.emailTrackers.find((x) => x.token === token) || null;
    },
    insert: async (
      t: Omit<
        DBEmailTracker,
        | "id"
        | "openCount"
        | "clickCount"
        | "replyCount"
        | "bounceCount"
        | "totalReadTimeMs"
        | "lastReadClassification"
        | "lastOpenedAt"
        | "lastClickedAt"
        | "lastRepliedAt"
        | "lastBouncedAt"
        | "createdAt"
        | "updatedAt"
      >,
    ) => {
      const orgId = getActiveOrgId();
      if (t.orgId !== orgId) {
        throw new Error("RLS Isolation Violation: Tenant mismatch.");
      }
      const newTracker: DBEmailTracker = {
        ...t,
        id: `tracker-${Math.random().toString(36).substring(2, 11)}`,
        openCount: 0,
        clickCount: 0,
        replyCount: 0,
        bounceCount: 0,
        totalReadTimeMs: 0,
        lastReadClassification: null,
        lastOpenedAt: null,
        lastClickedAt: null,
        lastRepliedAt: null,
        lastBouncedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      store.emailTrackers.push(newTracker);
      return newTracker;
    },
    update: async (
      id: string,
      updates: Partial<
        Omit<
          DBEmailTracker,
          "id" | "orgId" | "activityId" | "token" | "createdAt" | "updatedAt"
        >
      >,
    ) => {
      const orgId = getActiveOrgId();
      const index = store.emailTrackers.findIndex((x) => x.id === id);
      if (index === -1) return null;
      if (store.emailTrackers[index].orgId !== orgId) {
        throw new Error("RLS Isolation Violation: Tenant mismatch.");
      }
      store.emailTrackers[index] = {
        ...store.emailTrackers[index],
        ...updates,
        updatedAt: new Date(),
      };
      return store.emailTrackers[index];
    },
    updatePublic: async (
      id: string,
      updates: Partial<
        Pick<
          DBEmailTracker,
          | "openCount"
          | "clickCount"
          | "replyCount"
          | "bounceCount"
          | "totalReadTimeMs"
          | "lastReadClassification"
          | "lastOpenedAt"
          | "lastClickedAt"
          | "lastRepliedAt"
          | "lastBouncedAt"
          | "updatedAt"
        >
      >,
    ) => {
      const index = store.emailTrackers.findIndex((x) => x.id === id);
      if (index === -1) return null;
      store.emailTrackers[index] = {
        ...store.emailTrackers[index],
        ...updates,
        updatedAt: new Date(),
      };
      return store.emailTrackers[index];
    },
    delete: async (id: string) => {
      const orgId = getActiveOrgId();
      const index = store.emailTrackers.findIndex((x) => x.id === id);
      if (index === -1) return false;
      if (store.emailTrackers[index].orgId !== orgId) {
        throw new Error("RLS Isolation Violation: Tenant mismatch.");
      }
      store.emailTrackers.splice(index, 1);
      return true;
    },
  },
  marketingSegments: {
    findMany: async () => {
      const orgId = getActiveOrgId();
      return store.marketingSegments.filter((c) => c.orgId === orgId);
    },
    findOne: async (id: string) => {
      const orgId = getActiveOrgId();
      const c = store.marketingSegments.find((x) => x.id === id);
      if (c && c.orgId !== orgId) return null;
      return c || null;
    },
    insert: async (
      item: Omit<DBMarketingSegment, "id" | "createdAt" | "updatedAt">,
    ) => {
      const orgId = getActiveOrgId();
      if (item.orgId !== orgId) {
        throw new Error("RLS Isolation Violation: Tenant mismatch.");
      }
      const newItem: DBMarketingSegment = {
        ...item,
        id: `seg-${Math.random().toString(36).substring(2, 11)}`,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      store.marketingSegments.push(newItem);
      return newItem;
    },
    update: async (
      id: string,
      updates: Partial<
        Omit<DBMarketingSegment, "id" | "orgId" | "createdAt" | "updatedAt">
      >,
    ) => {
      const orgId = getActiveOrgId();
      const index = store.marketingSegments.findIndex((c) => c.id === id);
      if (index === -1) return null;
      if (store.marketingSegments[index].orgId !== orgId) {
        throw new Error("RLS Isolation Violation: Tenant mismatch.");
      }
      store.marketingSegments[index] = {
        ...store.marketingSegments[index],
        ...updates,
        updatedAt: new Date(),
      };
      return store.marketingSegments[index];
    },
    delete: async (id: string) => {
      const orgId = getActiveOrgId();
      const index = store.marketingSegments.findIndex((c) => c.id === id);
      if (index === -1) return false;
      if (store.marketingSegments[index].orgId !== orgId) {
        throw new Error("RLS Isolation Violation: Tenant mismatch.");
      }
      store.marketingSegments.splice(index, 1);
      return true;
    },
  },
  marketingSequences: {
    findMany: async () => {
      const orgId = getActiveOrgId();
      return store.marketingSequences.filter((c) => c.orgId === orgId);
    },
    findOne: async (id: string) => {
      const orgId = getActiveOrgId();
      const c = store.marketingSequences.find((x) => x.id === id);
      if (c && c.orgId !== orgId) return null;
      return c || null;
    },
    insert: async (
      item: Omit<DBMarketingSequence, "id" | "createdAt" | "updatedAt">,
    ) => {
      const orgId = getActiveOrgId();
      if (item.orgId !== orgId) {
        throw new Error("RLS Isolation Violation: Tenant mismatch.");
      }
      const newItem: DBMarketingSequence = {
        ...item,
        senderType: item.senderType ?? "system",
        senderUserId: item.senderUserId ?? null,
        id: `seq-${Math.random().toString(36).substring(2, 11)}`,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      store.marketingSequences.push(newItem);
      return newItem;
    },
    update: async (
      id: string,
      updates: Partial<
        Omit<DBMarketingSequence, "id" | "orgId" | "createdAt" | "updatedAt">
      >,
    ) => {
      const orgId = getActiveOrgId();
      const index = store.marketingSequences.findIndex((c) => c.id === id);
      if (index === -1) return null;
      if (store.marketingSequences[index].orgId !== orgId) {
        throw new Error("RLS Isolation Violation: Tenant mismatch.");
      }
      store.marketingSequences[index] = {
        ...store.marketingSequences[index],
        ...updates,
        updatedAt: new Date(),
      };
      return store.marketingSequences[index];
    },
    delete: async (id: string) => {
      const orgId = getActiveOrgId();
      const index = store.marketingSequences.findIndex((c) => c.id === id);
      if (index === -1) return false;
      if (store.marketingSequences[index].orgId !== orgId) {
        throw new Error("RLS Isolation Violation: Tenant mismatch.");
      }
      store.marketingSequences.splice(index, 1);
      return true;
    },
  },
  marketingSequenceSteps: {
    findMany: async () => {
      const orgId = getActiveOrgId();
      return store.marketingSequenceSteps.filter((c) => c.orgId === orgId);
    },
    findForSequence: async (sequenceId: string) => {
      const orgId = getActiveOrgId();
      return store.marketingSequenceSteps.filter(
        (s) => s.sequenceId === sequenceId && s.orgId === orgId,
      );
    },
    findOne: async (id: string) => {
      const orgId = getActiveOrgId();
      const m = store.marketingSequenceSteps.find((x) => x.id === id);
      if (m && m.orgId !== orgId) return null;
      return m || null;
    },
    insert: async (
      item: Omit<DBMarketingSequenceStep, "id" | "createdAt" | "updatedAt">,
    ) => {
      const orgId = getActiveOrgId();
      if (item.orgId !== orgId) {
        throw new Error("RLS Isolation Violation: Tenant mismatch.");
      }
      const newItem: DBMarketingSequenceStep = {
        ...item,
        id: `step-${Math.random().toString(36).substring(2, 11)}`,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      store.marketingSequenceSteps.push(newItem);
      return newItem;
    },
    update: async (
      id: string,
      updates: Partial<
        Omit<
          DBMarketingSequenceStep,
          "id" | "orgId" | "createdAt" | "updatedAt"
        >
      >,
    ) => {
      const orgId = getActiveOrgId();
      const index = store.marketingSequenceSteps.findIndex((c) => c.id === id);
      if (index === -1) return null;
      if (store.marketingSequenceSteps[index].orgId !== orgId) {
        throw new Error("RLS Isolation Violation: Tenant mismatch.");
      }
      store.marketingSequenceSteps[index] = {
        ...store.marketingSequenceSteps[index],
        ...updates,
        updatedAt: new Date(),
      };
      return store.marketingSequenceSteps[index];
    },
    delete: async (id: string) => {
      const orgId = getActiveOrgId();
      const index = store.marketingSequenceSteps.findIndex((c) => c.id === id);
      if (index === -1) return false;
      if (store.marketingSequenceSteps[index].orgId !== orgId) {
        throw new Error("RLS Isolation Violation: Tenant mismatch.");
      }
      store.marketingSequenceSteps.splice(index, 1);
      return true;
    },
  },
  marketingSequenceMemberships: {
    findMany: async () => {
      const orgId = getActiveOrgId();
      return store.marketingSequenceMemberships.filter(
        (c) => c.orgId === orgId,
      );
    },
    findForSequence: async (sequenceId: string) => {
      const orgId = getActiveOrgId();
      return store.marketingSequenceMemberships.filter(
        (m) => m.sequenceId === sequenceId && m.orgId === orgId,
      );
    },
    findOne: async (id: string) => {
      const orgId = getActiveOrgId();
      const m = store.marketingSequenceMemberships.find((x) => x.id === id);
      if (m && m.orgId !== orgId) return null;
      return m || null;
    },
    insert: async (
      item: Omit<
        DBMarketingSequenceMembership,
        "id" | "createdAt" | "updatedAt"
      >,
    ) => {
      const orgId = getActiveOrgId();
      if (item.orgId !== orgId) {
        throw new Error("RLS Isolation Violation: Tenant mismatch.");
      }
      const newItem: DBMarketingSequenceMembership = {
        ...item,
        engagementScore: item.engagementScore ?? 0,
        id: `memb-${Math.random().toString(36).substring(2, 11)}`,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      store.marketingSequenceMemberships.push(newItem);
      return newItem;
    },
    update: async (
      id: string,
      updates: Partial<
        Omit<
          DBMarketingSequenceMembership,
          "id" | "orgId" | "createdAt" | "updatedAt"
        >
      >,
    ) => {
      const orgId = getActiveOrgId();
      const index = store.marketingSequenceMemberships.findIndex(
        (c) => c.id === id,
      );
      if (index === -1) return null;
      if (store.marketingSequenceMemberships[index].orgId !== orgId) {
        throw new Error("RLS Isolation Violation: Tenant mismatch.");
      }
      store.marketingSequenceMemberships[index] = {
        ...store.marketingSequenceMemberships[index],
        ...updates,
        updatedAt: new Date(),
      };
      return store.marketingSequenceMemberships[index];
    },
    delete: async (id: string) => {
      const orgId = getActiveOrgId();
      const index = store.marketingSequenceMemberships.findIndex(
        (c) => c.id === id,
      );
      if (index === -1) return false;
      if (store.marketingSequenceMemberships[index].orgId !== orgId) {
        throw new Error("RLS Isolation Violation: Tenant mismatch.");
      }
      store.marketingSequenceMemberships.splice(index, 1);
      return true;
    },
  },
  marketingSequenceExitTriggers: {
    findMany: async () => {
      const orgId = getActiveOrgId();
      return store.marketingSequenceExitTriggers.filter(
        (c) => c.orgId === orgId,
      );
    },
    findForSequence: async (sequenceId: string) => {
      const orgId = getActiveOrgId();
      return store.marketingSequenceExitTriggers.filter(
        (m) => m.sequenceId === sequenceId && m.orgId === orgId,
      );
    },
    findOne: async (id: string) => {
      const orgId = getActiveOrgId();
      const m = store.marketingSequenceExitTriggers.find((x) => x.id === id);
      if (m && m.orgId !== orgId) return null;
      return m || null;
    },
    insert: async (
      item: Omit<
        DBMarketingSequenceExitTrigger,
        "id" | "createdAt" | "updatedAt"
      >,
    ) => {
      const orgId = getActiveOrgId();
      if (item.orgId !== orgId) {
        throw new Error("RLS Isolation Violation: Tenant mismatch.");
      }
      const newItem: DBMarketingSequenceExitTrigger = {
        ...item,
        id: `trig-${Math.random().toString(36).substring(2, 11)}`,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      store.marketingSequenceExitTriggers.push(newItem);
      return newItem;
    },
    delete: async (id: string) => {
      const orgId = getActiveOrgId();
      const index = store.marketingSequenceExitTriggers.findIndex(
        (c) => c.id === id,
      );
      if (index === -1) return false;
      if (store.marketingSequenceExitTriggers[index].orgId !== orgId) {
        throw new Error("RLS Isolation Violation: Tenant mismatch.");
      }
      store.marketingSequenceExitTriggers.splice(index, 1);
      return true;
    },
  },
  marketingSequenceScoreTriggers: {
    findMany: async () => {
      const orgId = getActiveOrgId();
      return store.marketingSequenceScoreTriggers.filter(
        (c) => c.orgId === orgId,
      );
    },
    findForSequence: async (sequenceId: string) => {
      const orgId = getActiveOrgId();
      return store.marketingSequenceScoreTriggers.filter(
        (m) => m.sequenceId === sequenceId && m.orgId === orgId,
      );
    },
    findOne: async (id: string) => {
      const orgId = getActiveOrgId();
      const m = store.marketingSequenceScoreTriggers.find((x) => x.id === id);
      if (m && m.orgId !== orgId) return null;
      return m || null;
    },
    insert: async (
      item: Omit<
        DBMarketingSequenceScoreTrigger,
        "id" | "createdAt" | "updatedAt"
      >,
    ) => {
      const orgId = getActiveOrgId();
      if (item.orgId !== orgId) {
        throw new Error("RLS Isolation Violation: Tenant mismatch.");
      }
      const newItem: DBMarketingSequenceScoreTrigger = {
        ...item,
        id: `sctr-${Math.random().toString(36).substring(2, 11)}`,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      store.marketingSequenceScoreTriggers.push(newItem);
      return newItem;
    },
    delete: async (id: string) => {
      const orgId = getActiveOrgId();
      const index = store.marketingSequenceScoreTriggers.findIndex(
        (c) => c.id === id,
      );
      if (index === -1) return false;
      if (store.marketingSequenceScoreTriggers[index].orgId !== orgId) {
        throw new Error("RLS Isolation Violation: Tenant mismatch.");
      }
      store.marketingSequenceScoreTriggers.splice(index, 1);
      return true;
    },
  },
  marketingSequenceGlobalVariables: {
    findMany: async () => {
      const orgId = getActiveOrgId();
      return store.marketingSequenceGlobalVariables.filter(
        (c) => c.orgId === orgId,
      );
    },
    findOne: async (id: string) => {
      const orgId = getActiveOrgId();
      const m = store.marketingSequenceGlobalVariables.find((x) => x.id === id);
      if (m && m.orgId !== orgId) return null;
      return m || null;
    },
    insert: async (
      item: Omit<
        DBMarketingSequenceGlobalVariable,
        "id" | "createdAt" | "updatedAt"
      >,
    ) => {
      const orgId = getActiveOrgId();
      if (item.orgId !== orgId) {
        throw new Error("RLS Isolation Violation: Tenant mismatch.");
      }
      const existingIndex = store.marketingSequenceGlobalVariables.findIndex(
        (c) => c.orgId === orgId && c.key === item.key,
      );
      if (existingIndex !== -1) {
        const updated = {
          ...store.marketingSequenceGlobalVariables[existingIndex],
          value: item.value,
          updatedAt: new Date(),
        };
        store.marketingSequenceGlobalVariables[existingIndex] = updated;
        return updated;
      }
      const newItem: DBMarketingSequenceGlobalVariable = {
        ...item,
        id: `msvg-${Math.random().toString(36).substring(2, 11)}`,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      store.marketingSequenceGlobalVariables.push(newItem);
      return newItem;
    },
    delete: async (id: string) => {
      const orgId = getActiveOrgId();
      const index = store.marketingSequenceGlobalVariables.findIndex(
        (c) => c.id === id,
      );
      if (index === -1) return false;
      if (store.marketingSequenceGlobalVariables[index].orgId !== orgId) {
        throw new Error("RLS Isolation Violation: Tenant mismatch.");
      }
      store.marketingSequenceGlobalVariables.splice(index, 1);
      return true;
    },
  },
  marketingSequenceFolders: {
    findMany: async () => {
      const orgId = getActiveOrgId();
      return store.marketingSequenceFolders.filter((c) => c.orgId === orgId);
    },
    findOne: async (id: string) => {
      const orgId = getActiveOrgId();
      const folder = store.marketingSequenceFolders.find((x) => x.id === id);
      if (folder && folder.orgId !== orgId) return null;
      return folder || null;
    },
    insert: async (
      item: Omit<DBMarketingSequenceFolder, "id" | "createdAt">,
    ) => {
      const orgId = getActiveOrgId();
      if (item.orgId !== orgId) {
        throw new Error("RLS Isolation Violation: Tenant mismatch.");
      }
      const newItem: DBMarketingSequenceFolder = {
        ...item,
        id: `msfo-${Math.random().toString(36).substring(2, 11)}`,
        createdAt: new Date(),
      };
      store.marketingSequenceFolders.push(newItem);
      return newItem;
    },
    update: async (
      id: string,
      updates: Partial<Omit<DBMarketingSequenceFolder, "id" | "orgId">>,
    ) => {
      const orgId = getActiveOrgId();
      const index = store.marketingSequenceFolders.findIndex(
        (c) => c.id === id,
      );
      if (index === -1) return null;
      if (store.marketingSequenceFolders[index].orgId !== orgId) {
        throw new Error("RLS Isolation Violation: Tenant mismatch.");
      }
      store.marketingSequenceFolders[index] = {
        ...store.marketingSequenceFolders[index],
        ...updates,
      };
      return store.marketingSequenceFolders[index];
    },
    delete: async (id: string) => {
      const orgId = getActiveOrgId();
      const index = store.marketingSequenceFolders.findIndex(
        (c) => c.id === id,
      );
      if (index === -1) return false;
      if (store.marketingSequenceFolders[index].orgId !== orgId) {
        throw new Error("RLS Isolation Violation: Tenant mismatch.");
      }
      store.marketingSequenceFolders.splice(index, 1);
      return true;
    },
  },
  marketingSequenceTags: {
    findMany: async () => {
      const orgId = getActiveOrgId();
      return store.marketingSequenceTags.filter((c) => c.orgId === orgId);
    },
    findOne: async (id: string) => {
      const orgId = getActiveOrgId();
      const tag = store.marketingSequenceTags.find((x) => x.id === id);
      if (tag && tag.orgId !== orgId) return null;
      return tag || null;
    },
    insert: async (item: Omit<DBMarketingSequenceTag, "id" | "createdAt">) => {
      const orgId = getActiveOrgId();
      if (item.orgId !== orgId) {
        throw new Error("RLS Isolation Violation: Tenant mismatch.");
      }
      const newItem: DBMarketingSequenceTag = {
        ...item,
        id: `msta-${Math.random().toString(36).substring(2, 11)}`,
        createdAt: new Date(),
      };
      store.marketingSequenceTags.push(newItem);
      return newItem;
    },
    delete: async (id: string) => {
      const orgId = getActiveOrgId();
      const index = store.marketingSequenceTags.findIndex((c) => c.id === id);
      if (index === -1) return false;
      if (store.marketingSequenceTags[index].orgId !== orgId) {
        throw new Error("RLS Isolation Violation: Tenant mismatch.");
      }
      store.marketingSequenceTags.splice(index, 1);
      return true;
    },
  },
  marketingSequenceTagMappings: {
    findMany: async () => {
      const orgId = getActiveOrgId();
      return store.marketingSequenceTagMappings.filter(
        (c) => c.orgId === orgId,
      );
    },
    findForSequence: async (sequenceId: string) => {
      const orgId = getActiveOrgId();
      return store.marketingSequenceTagMappings.filter(
        (c) => c.sequenceId === sequenceId && c.orgId === orgId,
      );
    },
    findOne: async (id: string) => {
      const orgId = getActiveOrgId();
      const mapping = store.marketingSequenceTagMappings.find(
        (x) => x.id === id,
      );
      if (mapping && mapping.orgId !== orgId) return null;
      return mapping || null;
    },
    insert: async (item: Omit<DBMarketingSequenceTagMapping, "id">) => {
      const orgId = getActiveOrgId();
      if (item.orgId !== orgId) {
        throw new Error("RLS Isolation Violation: Tenant mismatch.");
      }
      const newItem: DBMarketingSequenceTagMapping = {
        ...item,
        id: `mstm-${Math.random().toString(36).substring(2, 11)}`,
      };
      store.marketingSequenceTagMappings.push(newItem);
      return newItem;
    },
    delete: async (id: string) => {
      const orgId = getActiveOrgId();
      const index = store.marketingSequenceTagMappings.findIndex(
        (c) => c.id === id,
      );
      if (index === -1) return false;
      if (store.marketingSequenceTagMappings[index].orgId !== orgId) {
        throw new Error("RLS Isolation Violation: Tenant mismatch.");
      }
      store.marketingSequenceTagMappings.splice(index, 1);
      return true;
    },
    deleteForSequenceAndTag: async (sequenceId: string, tagId: string) => {
      const orgId = getActiveOrgId();
      const index = store.marketingSequenceTagMappings.findIndex(
        (c) =>
          c.sequenceId === sequenceId && c.tagId === tagId && c.orgId === orgId,
      );
      if (index === -1) return false;
      store.marketingSequenceTagMappings.splice(index, 1);
      return true;
    },
  },
  marketingSequenceStepSplitTests: {
    findMany: async () => {
      const orgId = getActiveOrgId();
      return store.marketingSequenceStepSplitTests.filter(
        (c) => c.orgId === orgId,
      );
    },
    findForStep: async (stepId: string) => {
      const orgId = getActiveOrgId();
      return (
        store.marketingSequenceStepSplitTests.find(
          (m) => m.stepId === stepId && m.orgId === orgId,
        ) || null
      );
    },
    findOne: async (id: string) => {
      const orgId = getActiveOrgId();
      const m = store.marketingSequenceStepSplitTests.find((x) => x.id === id);
      if (m && m.orgId !== orgId) return null;
      return m || null;
    },
    insert: async (
      item: Omit<
        DBMarketingSequenceStepSplitTest,
        "id" | "createdAt" | "updatedAt"
      >,
    ) => {
      const orgId = getActiveOrgId();
      if (item.orgId !== orgId) {
        throw new Error("RLS Isolation Violation: Tenant mismatch.");
      }
      const newItem: DBMarketingSequenceStepSplitTest = {
        autoPromoteWinner: 0,
        minSendsToEvaluate: 10,
        evaluationMetric: "open_rate",
        ...item,
        id: `split-${Math.random().toString(36).substring(2, 11)}`,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      store.marketingSequenceStepSplitTests.push(newItem);
      return newItem;
    },
    update: async (
      id: string,
      updates: Partial<
        Omit<
          DBMarketingSequenceStepSplitTest,
          "id" | "orgId" | "createdAt" | "updatedAt"
        >
      >,
    ) => {
      const orgId = getActiveOrgId();
      const index = store.marketingSequenceStepSplitTests.findIndex(
        (c) => c.id === id,
      );
      if (index === -1) return null;
      if (store.marketingSequenceStepSplitTests[index].orgId !== orgId) {
        throw new Error("RLS Isolation Violation: Tenant mismatch.");
      }
      store.marketingSequenceStepSplitTests[index] = {
        ...store.marketingSequenceStepSplitTests[index],
        ...updates,
        updatedAt: new Date(),
      };
      return store.marketingSequenceStepSplitTests[index];
    },
    delete: async (id: string) => {
      const orgId = getActiveOrgId();
      const index = store.marketingSequenceStepSplitTests.findIndex(
        (c) => c.id === id,
      );
      if (index === -1) return false;
      if (store.marketingSequenceStepSplitTests[index].orgId !== orgId) {
        throw new Error("RLS Isolation Violation: Tenant mismatch.");
      }
      store.marketingSequenceStepSplitTests.splice(index, 1);
      return true;
    },
  },
  marketingSequenceStepBranches: {
    findMany: async () => {
      const orgId = getActiveOrgId();
      return store.marketingSequenceStepBranches.filter(
        (c) => c.orgId === orgId,
      );
    },
    findForStep: async (stepId: string) => {
      const orgId = getActiveOrgId();
      return (
        store.marketingSequenceStepBranches.find(
          (m) => m.stepId === stepId && m.orgId === orgId,
        ) || null
      );
    },
    findOne: async (id: string) => {
      const orgId = getActiveOrgId();
      const m = store.marketingSequenceStepBranches.find((x) => x.id === id);
      if (m && m.orgId !== orgId) return null;
      return m || null;
    },
    insert: async (
      item: Omit<
        DBMarketingSequenceStepBranch,
        "id" | "createdAt" | "updatedAt"
      >,
    ) => {
      const orgId = getActiveOrgId();
      if (item.orgId !== orgId) {
        throw new Error("RLS Isolation Violation: Tenant mismatch.");
      }
      const newItem: DBMarketingSequenceStepBranch = {
        ...item,
        id: `branch-${Math.random().toString(36).substring(2, 11)}`,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      store.marketingSequenceStepBranches.push(newItem);
      return newItem;
    },
    update: async (
      id: string,
      updates: Partial<
        Omit<
          DBMarketingSequenceStepBranch,
          "id" | "orgId" | "createdAt" | "updatedAt"
        >
      >,
    ) => {
      const orgId = getActiveOrgId();
      const index = store.marketingSequenceStepBranches.findIndex(
        (c) => c.id === id,
      );
      if (index === -1) return null;
      if (store.marketingSequenceStepBranches[index].orgId !== orgId) {
        throw new Error("RLS Isolation Violation: Tenant mismatch.");
      }
      store.marketingSequenceStepBranches[index] = {
        ...store.marketingSequenceStepBranches[index],
        ...updates,
        updatedAt: new Date(),
      };
      return store.marketingSequenceStepBranches[index];
    },
    delete: async (id: string) => {
      const orgId = getActiveOrgId();
      const index = store.marketingSequenceStepBranches.findIndex(
        (c) => c.id === id,
      );
      if (index === -1) return false;
      if (store.marketingSequenceStepBranches[index].orgId !== orgId) {
        throw new Error("RLS Isolation Violation: Tenant mismatch.");
      }
      store.marketingSequenceStepBranches.splice(index, 1);
      return true;
    },
  },
  marketingSequenceGoals: {
    findMany: async () => {
      const orgId = getActiveOrgId();
      return store.marketingSequenceGoals.filter((c) => c.orgId === orgId);
    },
    findForSequence: async (sequenceId: string) => {
      const orgId = getActiveOrgId();
      return store.marketingSequenceGoals.filter(
        (m) => m.sequenceId === sequenceId && m.orgId === orgId,
      );
    },
    findOne: async (id: string) => {
      const orgId = getActiveOrgId();
      const m = store.marketingSequenceGoals.find((x) => x.id === id);
      if (m && m.orgId !== orgId) return null;
      return m || null;
    },
    insert: async (
      item: Omit<DBMarketingSequenceGoal, "id" | "createdAt" | "updatedAt">,
    ) => {
      const orgId = getActiveOrgId();
      if (item.orgId !== orgId) {
        throw new Error("RLS Isolation Violation: Tenant mismatch.");
      }
      const newItem: DBMarketingSequenceGoal = {
        ...item,
        id: `goal-${Math.random().toString(36).substring(2, 11)}`,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      store.marketingSequenceGoals.push(newItem);
      return newItem;
    },
    delete: async (id: string) => {
      const orgId = getActiveOrgId();
      const index = store.marketingSequenceGoals.findIndex((c) => c.id === id);
      if (index === -1) return false;
      if (store.marketingSequenceGoals[index].orgId !== orgId) {
        throw new Error("RLS Isolation Violation: Tenant mismatch.");
      }
      store.marketingSequenceGoals.splice(index, 1);
      return true;
    },
  },
  marketingSequenceConversions: {
    findMany: async () => {
      const orgId = getActiveOrgId();
      return store.marketingSequenceConversions.filter(
        (c) => c.orgId === orgId,
      );
    },
    findForSequence: async (sequenceId: string) => {
      const orgId = getActiveOrgId();
      return store.marketingSequenceConversions.filter(
        (m) => m.sequenceId === sequenceId && m.orgId === orgId,
      );
    },
    findOne: async (id: string) => {
      const orgId = getActiveOrgId();
      const m = store.marketingSequenceConversions.find((x) => x.id === id);
      if (m && m.orgId !== orgId) return null;
      return m || null;
    },
    insert: async (
      item: Omit<DBMarketingSequenceConversion, "id" | "createdAt">,
    ) => {
      const orgId = getActiveOrgId();
      if (item.orgId !== orgId) {
        throw new Error("RLS Isolation Violation: Tenant mismatch.");
      }
      const newItem: DBMarketingSequenceConversion = {
        ...item,
        id: `conv-${Math.random().toString(36).substring(2, 11)}`,
        createdAt: new Date(),
      };
      store.marketingSequenceConversions.push(newItem);
      return newItem;
    },
    delete: async (id: string) => {
      const orgId = getActiveOrgId();
      const index = store.marketingSequenceConversions.findIndex(
        (c) => c.id === id,
      );
      if (index === -1) return false;
      if (store.marketingSequenceConversions[index].orgId !== orgId) {
        throw new Error("RLS Isolation Violation: Tenant mismatch.");
      }
      store.marketingSequenceConversions.splice(index, 1);
      return true;
    },
  },
  marketingSequenceSuppressions: {
    findMany: async () => {
      const orgId = getActiveOrgId();
      return store.marketingSequenceSuppressions.filter(
        (c) => c.orgId === orgId,
      );
    },
    findForOrg: async (orgId: string) => {
      const activeOrgId = getActiveOrgId();
      if (orgId !== activeOrgId) {
        throw new Error("RLS Isolation Violation: Tenant mismatch.");
      }
      return store.marketingSequenceSuppressions.filter(
        (c) => c.orgId === orgId,
      );
    },
    findOne: async (id: string) => {
      const orgId = getActiveOrgId();
      const m = store.marketingSequenceSuppressions.find((x) => x.id === id);
      if (m && m.orgId !== orgId) return null;
      return m || null;
    },
    insert: async (
      item: Omit<DBMarketingSequenceSuppression, "id" | "createdAt">,
    ) => {
      const orgId = getActiveOrgId();
      if (item.orgId !== orgId) {
        throw new Error("RLS Isolation Violation: Tenant mismatch.");
      }
      const newItem: DBMarketingSequenceSuppression = {
        ...item,
        id: `supp-${Math.random().toString(36).substring(2, 11)}`,
        createdAt: new Date(),
      };
      store.marketingSequenceSuppressions.push(newItem);
      return newItem;
    },
    delete: async (id: string) => {
      const orgId = getActiveOrgId();
      const index = store.marketingSequenceSuppressions.findIndex(
        (c) => c.id === id,
      );
      if (index === -1) return false;
      if (store.marketingSequenceSuppressions[index].orgId !== orgId) {
        throw new Error("RLS Isolation Violation: Tenant mismatch.");
      }
      store.marketingSequenceSuppressions.splice(index, 1);
      return true;
    },
  },
  marketingSequenceExclusions: {
    findMany: async () => {
      const orgId = getActiveOrgId();
      return store.marketingSequenceExclusions.filter((c) => c.orgId === orgId);
    },
    findForSequence: async (sequenceId: string) => {
      const orgId = getActiveOrgId();
      return store.marketingSequenceExclusions.filter(
        (m) => m.sequenceId === sequenceId && m.orgId === orgId,
      );
    },
    findOne: async (id: string) => {
      const orgId = getActiveOrgId();
      const m = store.marketingSequenceExclusions.find((x) => x.id === id);
      if (m && m.orgId !== orgId) return null;
      return m || null;
    },
    insert: async (
      item: Omit<
        DBMarketingSequenceExclusion,
        "id" | "createdAt" | "updatedAt"
      >,
    ) => {
      const orgId = getActiveOrgId();
      if (item.orgId !== orgId) {
        throw new Error("RLS Isolation Violation: Tenant mismatch.");
      }
      const newItem: DBMarketingSequenceExclusion = {
        ...item,
        id: `excl-${Math.random().toString(36).substring(2, 11)}`,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      store.marketingSequenceExclusions.push(newItem);
      return newItem;
    },
    delete: async (id: string) => {
      const orgId = getActiveOrgId();
      const index = store.marketingSequenceExclusions.findIndex(
        (c) => c.id === id,
      );
      if (index === -1) return false;
      if (store.marketingSequenceExclusions[index].orgId !== orgId) {
        throw new Error("RLS Isolation Violation: Tenant mismatch.");
      }
      store.marketingSequenceExclusions.splice(index, 1);
      return true;
    },
  },
  marketingSequenceAbAllocations: {
    findMany: async () => {
      const orgId = getActiveOrgId();
      return store.marketingSequenceAbAllocations.filter(
        (c) => c.orgId === orgId,
      );
    },
    findForMemberAndStep: async (membershipId: string, stepId: string) => {
      const orgId = getActiveOrgId();
      return (
        store.marketingSequenceAbAllocations.find(
          (m) =>
            m.membershipId === membershipId &&
            m.stepId === stepId &&
            m.orgId === orgId,
        ) || null
      );
    },
    insert: async (
      item: Omit<DBMarketingSequenceAbAllocation, "id" | "createdAt">,
    ) => {
      const orgId = getActiveOrgId();
      if (item.orgId !== orgId) {
        throw new Error("RLS Isolation Violation: Tenant mismatch.");
      }
      const newItem: DBMarketingSequenceAbAllocation = {
        ...item,
        id: `alloc-${Math.random().toString(36).substring(2, 11)}`,
        createdAt: new Date(),
      };
      store.marketingSequenceAbAllocations.push(newItem);
      return newItem;
    },
  },
  marketingSequenceCaps: {
    findMany: async () => {
      const orgId = getActiveOrgId();
      return store.marketingSequenceCaps.filter((c) => c.orgId === orgId);
    },
    findOne: async (id: string) => {
      const orgId = getActiveOrgId();
      const m = store.marketingSequenceCaps.find((x) => x.id === id);
      if (m && m.orgId !== orgId) return null;
      return m || null;
    },
    insert: async (
      item: Omit<DBMarketingSequenceCap, "id" | "createdAt" | "updatedAt">,
    ) => {
      const orgId = getActiveOrgId();
      if (item.orgId !== orgId) {
        throw new Error("RLS Isolation Violation: Tenant mismatch.");
      }
      const newItem: DBMarketingSequenceCap = {
        ...item,
        id: `cap-${Math.random().toString(36).substring(2, 11)}`,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      store.marketingSequenceCaps.push(newItem);
      return newItem;
    },
    update: async (
      id: string,
      updates: Partial<
        Omit<DBMarketingSequenceCap, "id" | "orgId" | "createdAt" | "updatedAt">
      >,
    ) => {
      const orgId = getActiveOrgId();
      const index = store.marketingSequenceCaps.findIndex((x) => x.id === id);
      if (index === -1) return null;
      if (store.marketingSequenceCaps[index].orgId !== orgId) {
        throw new Error("RLS Isolation Violation: Tenant mismatch.");
      }
      store.marketingSequenceCaps[index] = {
        ...store.marketingSequenceCaps[index],
        ...updates,
        updatedAt: new Date(),
      };
      return store.marketingSequenceCaps[index];
    },
    delete: async (id: string) => {
      const orgId = getActiveOrgId();
      const index = store.marketingSequenceCaps.findIndex((c) => c.id === id);
      if (index === -1) return false;
      if (store.marketingSequenceCaps[index].orgId !== orgId) {
        throw new Error("RLS Isolation Violation: Tenant mismatch.");
      }
      store.marketingSequenceCaps.splice(index, 1);
      return true;
    },
  },
  marketingSequenceLinkActions: {
    findMany: async () => {
      const orgId = getActiveOrgId();
      return store.marketingSequenceLinkActions.filter(
        (c) => c.orgId === orgId,
      );
    },
    findForStep: async (stepId: string) => {
      const orgId = getActiveOrgId();
      return store.marketingSequenceLinkActions.filter(
        (c) => c.stepId === stepId && c.orgId === orgId,
      );
    },
    findOne: async (id: string) => {
      const orgId = getActiveOrgId();
      const m = store.marketingSequenceLinkActions.find((x) => x.id === id);
      if (m && m.orgId !== orgId) return null;
      return m || null;
    },
    insert: async (
      item: Omit<
        DBMarketingSequenceLinkAction,
        "id" | "createdAt" | "updatedAt"
      >,
    ) => {
      const orgId = getActiveOrgId();
      if (item.orgId !== orgId) {
        throw new Error("RLS Isolation Violation: Tenant mismatch.");
      }
      const newItem: DBMarketingSequenceLinkAction = {
        ...item,
        id: `act-${Math.random().toString(36).substring(2, 11)}`,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      store.marketingSequenceLinkActions.push(newItem);
      return newItem;
    },
    delete: async (id: string) => {
      const orgId = getActiveOrgId();
      const index = store.marketingSequenceLinkActions.findIndex(
        (c) => c.id === id,
      );
      if (index === -1) return false;
      if (store.marketingSequenceLinkActions[index].orgId !== orgId) {
        throw new Error("RLS Isolation Violation: Tenant mismatch.");
      }
      store.marketingSequenceLinkActions.splice(index, 1);
      return true;
    },
  },
  marketingSequenceOpenActions: {
    findMany: async () => {
      const orgId = getActiveOrgId();
      return store.marketingSequenceOpenActions.filter(
        (c) => c.orgId === orgId,
      );
    },
    findForStep: async (stepId: string) => {
      const orgId = getActiveOrgId();
      return store.marketingSequenceOpenActions.filter(
        (c) => c.stepId === stepId && c.orgId === orgId,
      );
    },
    findOne: async (id: string) => {
      const orgId = getActiveOrgId();
      const m = store.marketingSequenceOpenActions.find((x) => x.id === id);
      if (m && m.orgId !== orgId) return null;
      return m || null;
    },
    insert: async (
      item: Omit<
        DBMarketingSequenceOpenAction,
        "id" | "createdAt" | "updatedAt"
      >,
    ) => {
      const orgId = getActiveOrgId();
      if (item.orgId !== orgId) {
        throw new Error("RLS Isolation Violation: Tenant mismatch.");
      }
      const newItem: DBMarketingSequenceOpenAction = {
        ...item,
        id: `act-${Math.random().toString(36).substring(2, 11)}`,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      store.marketingSequenceOpenActions.push(newItem);
      return newItem;
    },
    delete: async (id: string) => {
      const orgId = getActiveOrgId();
      const index = store.marketingSequenceOpenActions.findIndex(
        (c) => c.id === id,
      );
      if (index === -1) return false;
      if (store.marketingSequenceOpenActions[index].orgId !== orgId) {
        throw new Error("RLS Isolation Violation: Tenant mismatch.");
      }
      store.marketingSequenceOpenActions.splice(index, 1);
      return true;
    },
  },
  marketingSequenceReplyActions: {
    findMany: async () => {
      const orgId = getActiveOrgId();
      return store.marketingSequenceReplyActions.filter(
        (c) => c.orgId === orgId,
      );
    },
    findForStep: async (stepId: string) => {
      const orgId = getActiveOrgId();
      return store.marketingSequenceReplyActions.filter(
        (c) => c.stepId === stepId && c.orgId === orgId,
      );
    },
    findOne: async (id: string) => {
      const orgId = getActiveOrgId();
      const m = store.marketingSequenceReplyActions.find((x) => x.id === id);
      if (m && m.orgId !== orgId) return null;
      return m || null;
    },
    insert: async (
      item: Omit<
        DBMarketingSequenceReplyAction,
        "id" | "createdAt" | "updatedAt"
      >,
    ) => {
      const orgId = getActiveOrgId();
      if (item.orgId !== orgId) {
        throw new Error("RLS Isolation Violation: Tenant mismatch.");
      }
      const newItem: DBMarketingSequenceReplyAction = {
        ...item,
        id: `act-${Math.random().toString(36).substring(2, 11)}`,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      store.marketingSequenceReplyActions.push(newItem);
      return newItem;
    },
    delete: async (id: string) => {
      const orgId = getActiveOrgId();
      const index = store.marketingSequenceReplyActions.findIndex(
        (c) => c.id === id,
      );
      if (index === -1) return false;
      if (store.marketingSequenceReplyActions[index].orgId !== orgId) {
        throw new Error("RLS Isolation Violation: Tenant mismatch.");
      }
      store.marketingSequenceReplyActions.splice(index, 1);
      return true;
    },
  },

  emailClickEvents: {
    findMany: async () => {
      const orgId = getActiveOrgId();
      return store.emailClickEvents.filter((c) => c.orgId === orgId);
    },
    findForTracker: async (trackerId: string) => {
      const orgId = getActiveOrgId();
      return store.emailClickEvents.filter(
        (c) => c.trackerId === trackerId && c.orgId === orgId,
      );
    },
    findOne: async (id: string) => {
      const orgId = getActiveOrgId();
      const m = store.emailClickEvents.find((x) => x.id === id);
      if (m && m.orgId !== orgId) return null;
      return m || null;
    },
    insert: async (item: Omit<DBEmailClickEvent, "id" | "createdAt">) => {
      const orgId = getActiveOrgId();
      if (item.orgId !== orgId) {
        throw new Error("RLS Isolation Violation: Tenant mismatch.");
      }
      const newItem: DBEmailClickEvent = {
        ...item,
        id: `ev-${Math.random().toString(36).substring(2, 11)}`,
        createdAt: new Date(),
      };
      store.emailClickEvents.push(newItem);
      return newItem;
    },
  },

  emailUnsubscribes: {
    findMany: async () => {
      const orgId = getActiveOrgId();
      return store.emailUnsubscribes.filter((c) => c.orgId === orgId);
    },
    findOne: async (id: string) => {
      const orgId = getActiveOrgId();
      const m = store.emailUnsubscribes.find((x) => x.id === id);
      if (m && m.orgId !== orgId) return null;
      return m || null;
    },
    insert: async (item: Omit<DBEmailUnsubscribe, "id" | "createdAt">) => {
      const orgId = getActiveOrgId();
      if (item.orgId !== orgId) {
        throw new Error("RLS Isolation Violation: Tenant mismatch.");
      }
      const newItem: DBEmailUnsubscribe = {
        ...item,
        id: `unsub-${Math.random().toString(36).substring(2, 11)}`,
        createdAt: new Date(),
      };
      store.emailUnsubscribes.push(newItem);
      return newItem;
    },
  },

  emailOpenEvents: {
    findMany: async () => {
      const orgId = getActiveOrgId();
      return store.emailOpenEvents.filter((c) => c.orgId === orgId);
    },
    findForTracker: async (trackerId: string) => {
      const orgId = getActiveOrgId();
      return store.emailOpenEvents.filter(
        (c) => c.trackerId === trackerId && c.orgId === orgId,
      );
    },
    findOne: async (id: string) => {
      const orgId = getActiveOrgId();
      const m = store.emailOpenEvents.find((x) => x.id === id);
      if (m && m.orgId !== orgId) return null;
      return m || null;
    },
    insert: async (item: Omit<DBEmailOpenEvent, "id" | "createdAt">) => {
      const orgId = getActiveOrgId();
      if (item.orgId !== orgId) {
        throw new Error("RLS Isolation Violation: Tenant mismatch.");
      }
      const newItem: DBEmailOpenEvent = {
        ...item,
        id: `op-${Math.random().toString(36).substring(2, 11)}`,
        createdAt: new Date(),
      };
      store.emailOpenEvents.push(newItem);
      return newItem;
    },
  },

  emailReplyEvents: {
    findMany: async () => {
      const orgId = getActiveOrgId();
      return store.emailReplyEvents.filter((c) => c.orgId === orgId);
    },
    findForTracker: async (trackerId: string) => {
      const orgId = getActiveOrgId();
      return store.emailReplyEvents.filter(
        (c) => c.trackerId === trackerId && c.orgId === orgId,
      );
    },
    findOne: async (id: string) => {
      const orgId = getActiveOrgId();
      const m = store.emailReplyEvents.find((x) => x.id === id);
      if (m && m.orgId !== orgId) return null;
      return m || null;
    },
    insert: async (item: Omit<DBEmailReplyEvent, "id" | "createdAt">) => {
      const orgId = getActiveOrgId();
      if (item.orgId !== orgId) {
        throw new Error("RLS Isolation Violation: Tenant mismatch.");
      }
      const newItem: DBEmailReplyEvent = {
        ...item,
        id: `rep-${Math.random().toString(36).substring(2, 11)}`,
        createdAt: new Date(),
      };
      store.emailReplyEvents.push(newItem);
      return newItem;
    },
  },

  emailBounceEvents: {
    findMany: async () => {
      const orgId = getActiveOrgId();
      return store.emailBounceEvents.filter((c) => c.orgId === orgId);
    },
    findForTracker: async (trackerId: string) => {
      const orgId = getActiveOrgId();
      return store.emailBounceEvents.filter(
        (c) => c.trackerId === trackerId && c.orgId === orgId,
      );
    },
    findOne: async (id: string) => {
      const orgId = getActiveOrgId();
      const m = store.emailBounceEvents.find((x) => x.id === id);
      if (m && m.orgId !== orgId) return null;
      return m || null;
    },
    insert: async (item: Omit<DBEmailBounceEvent, "id" | "createdAt">) => {
      const orgId = getActiveOrgId();
      if (item.orgId !== orgId) {
        throw new Error("RLS Isolation Violation: Tenant mismatch.");
      }
      const newItem: DBEmailBounceEvent = {
        ...item,
        id: `bnc-${Math.random().toString(36).substring(2, 11)}`,
        createdAt: new Date(),
      };
      store.emailBounceEvents.push(newItem);
      return newItem;
    },
  },

  emailReadTimeEvents: {
    findMany: async () => {
      const orgId = getActiveOrgId();
      return store.emailReadTimeEvents.filter((c) => c.orgId === orgId);
    },
    findForTracker: async (trackerId: string) => {
      const orgId = getActiveOrgId();
      return store.emailReadTimeEvents.filter(
        (c) => c.trackerId === trackerId && c.orgId === orgId,
      );
    },
    findOne: async (id: string) => {
      const orgId = getActiveOrgId();
      const m = store.emailReadTimeEvents.find((x) => x.id === id);
      if (m && m.orgId !== orgId) return null;
      return m || null;
    },
    insert: async (item: Omit<DBEmailReadTimeEvent, "id" | "createdAt">) => {
      const orgId = getActiveOrgId();
      if (item.orgId !== orgId) {
        throw new Error("RLS Isolation Violation: Tenant mismatch.");
      }
      const newItem: DBEmailReadTimeEvent = {
        ...item,
        id: `rdt-${Math.random().toString(36).substring(2, 11)}`,
        createdAt: new Date(),
      };
      store.emailReadTimeEvents.push(newItem);
      return newItem;
    },
  },

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
