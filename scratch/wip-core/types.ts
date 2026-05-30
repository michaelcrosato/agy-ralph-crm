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
    custom: Record<string, unknown> | null;
  };
}

export interface LineItemInput {
  totalPrice: string;
}

export interface KanbanStageSummary {
  stage: string;
  opportunitiesCount: number;
  totalValue: string;
  opportunities: {
    id: string;
    name: string;
    amount: string | null;
    closeDate: Date | null;
    accountId: string | null;
  }[];
}

export interface ProRateInput {
  unitPrice: string;
  quantity: number;
  daysUsed: number;
  daysInPeriod: number;
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

export interface EmailLogInput {
  from: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  body: string;
}

export interface OpportunityRecord {
  id: string;
  orgId: string;
  stage: string;
  amount: string | null;
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

export interface TerritoryCriteriaCondition {
  field: string;
  operator: "equals" | "contains" | "greater_than" | "less_than";
  value: string;
}

export interface TerritoryInput {
  id: string;
  name: string;
  isActive: number;
  routingMethod: string;
  lastAssignedIndex: number;
  criteria: TerritoryCriteriaCondition[];
}

export interface TerritoryMemberInput {
  id: string;
  territoryId: string;
  userId: string;
  role: string;
}

export interface TerritoryMatchResult {
  matchedTerritoryId: string;
  newOwnerId: string | null;
  newLastAssignedIndex: number;
}

export interface SplitInput {
  userId: string;
  percentage: number;
}

export interface SplitResult {
  userId: string;
  percentage: number;
  splitAmount: string;
}

export interface CampaignStatsInput {
  budgetedCost: string;
  actualCost: string;
  expectedRevenue: string;
  members: { status: string }[];
  opportunities: { stage: string; amount: string | null }[];
}

export interface CampaignStatsResult {
  totalMembers: number;
  respondedMembers: number;
  responseRate: number;
  totalClosedWonRevenue: string;
  netRevenueRoi: string;
}

export interface StageHistoryInput {
  opportunityId: string;
  fromStage: string | null;
  toStage: string;
  createdAt: Date;
}

export interface StageDuration {
  stage: string;
  totalDurationMs: number;
  transitionCount: number;
  averageDurationDays: number;
}

export type FieldResolutionSource = "master" | "duplicate";

export interface MergeLeadsInput {
  master: LeadRecord;
  duplicate: LeadRecord;
  fieldResolution: Record<string, FieldResolutionSource>;
}

export interface DBOpportunityContactRole {
  id: string;
  orgId: string;
  opportunityId: string;
  contactId: string;
  role: string;
  isPrimary: boolean;
}

export interface CampaignInfluenceInput {
  campaignId: string;
  opportunityId: string;
  influencePercentage: number;
}

export interface ContractRecord {
  id: string;
  orgId: string;
  accountId: string;
  contractAmount: string;
  startDate: Date;
  endDate: Date;
  status: string;
}

export interface RenewalGenerationInput {
  contract: ContractRecord;
  accountName: string;
  escalationPercentage?: number;
}

export interface GeneratedRenewalOpportunity {
  orgId: string;
  accountId: string;
  name: string;
  stage: string;
  amount: string;
  closeDate: Date;
}

export interface SimpleAccountRelation {
  id: string;
  parentAccountId?: string | null;
}

export interface SimpleOpportunityRelation {
  accountId: string | null;
  stage: string;
  amount: string | null;
}

export interface SimpleContactRelation {
  id: string;
  reportsToId?: string | null;
}

export interface ScoringRuleInput {
  id: string;
  isActive: number;
  scoreValue: number;
  criteria: CriteriaCondition[];
}

export interface AccountRecord {
  id: string;
  orgId: string;
  ownerId: string;
  name: string;
  domain: string | null;
  custom: Record<string, unknown> | null;
  parentAccountId?: string | null;
}

export interface MergeAccountsInput {
  master: AccountRecord;
  duplicate: AccountRecord;
  fieldResolution: Record<string, FieldResolutionSource>;
}

export interface ContactRecord {
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

export interface MergeContactsInput {
  master: ContactRecord;
  duplicate: ContactRecord;
  fieldResolution: Record<string, FieldResolutionSource>;
}

export interface CompetitorInput {
  name: string;
  winLossStatus: string;
}

export interface CompetitorStats {
  competitorCount: number;
  wonCount: number;
  lostCount: number;
  pendingCount: number;
  competitorList: string[];
}

export interface LeadConversionMappingInput {
  sourceLeadField: string;
  targetObjectType: "accounts" | "contacts" | "opportunities";
  targetField: string;
}

export interface ConvertLeadWithMappingsInput {
  lead: LeadRecord;
  opportunityName?: string;
  opportunityAmount?: string;
  mappings: LeadConversionMappingInput[];
}

export interface StageGateRule {
  targetStage: string;
  field: string;
  operator: string;
  expectedValue: string | null;
  errorMessage: string;
  isActive: boolean;
}

export interface GeneratedSchedule {
  opportunityProductId: string;
  scheduleType: "revenue" | "quantity";
  scheduleDate: Date;
  amount: string;
  description: string;
}

export interface AutoConversionCriteria {
  field: string;
  operator: "equals" | "greater_or_equal" | "less_or_equal";
  value: string | number;
}

export interface CampaignROIMetrics {
  campaignId: string;
  campaignName: string;
  budgetedCost: number;
  actualCost: number;
  expectedRevenue: number;
  totalMembers: number;
  respondedMembers: number;
  wonOpportunitiesCount: number;
  wonRevenueShareSum: number;
  netValue: number;
  roi: number;
}

export interface CompetitorRecord {
  id: string;
  orgId: string;
  opportunityId: string;
  name: string;
  strength: string | null;
  weakness: string | null;
  winLossStatus: string; // "Pending" | "Won" | "Lost"
}

export interface GlobalCompetitorMetrics {
  name: string;
  totalCompetitions: number;
  wonCount: number;
  lostCount: number;
  winRate: number;
  totalValue: string;
  wonValue: string;
  strengths: string[];
  weaknesses: string[];
}

export interface StalledOpportunityResult {
  opportunityId: string;
  opportunityName: string;
  currentStage: string;
  elapsedDays: number;
  maxDaysAllowed: number;
  amount: string | null;
}

export interface StalledOpportunityOpportunity {
  id: string;
  name: string;
  stage: string;
  amount: string | null;
}

export interface StalledOpportunityStageHistory {
  opportunityId: string;
  toStage: string;
  createdAt: Date;
}

export interface StalledOpportunityStageDurationRule {
  stage: string;
  maxDaysAllowed: number;
}

export interface ConsentPreference {
  recordType: "lead" | "contact";
  recordId: string;
  channel: "email" | "sms" | "phone";
  status: "opt_in" | "opt_out" | "pending";
}

export interface ConsentValidationInput {
  channel: "email" | "sms" | "phone";
  preferences: ConsentPreference[];
}

export interface ExternalEmail {
  externalId: string;
  sender: string;
  recipient: string;
  subject: string;
  body: string;
  receivedAt: Date;
}

export interface ExternalCalendarEvent {
  externalId: string;
  title: string;
  description: string;
  attendees: string[]; // List of attendee email addresses
  eventDate: Date;
}

export interface SyncSimulationInput {
  settings: {
    syncEmails: boolean;
    syncCalendar: boolean;
  };
  externalEmails: ExternalEmail[];
  externalCalendarEvents: ExternalCalendarEvent[];
  existingLeads: { id: string; email: string | null }[];
  existingContacts: { id: string; email: string | null }[];
  existingActivityExternalIds: string[]; // Avoid importing duplicates
}

export interface ESignatureTransitionInput {
  currentStatus: "sent" | "viewed" | "signed" | "declined";
  action: "view" | "sign" | "decline";
}

export interface ESignatureTransitionResult {
  nextStatus: "sent" | "viewed" | "signed" | "declined";
  isCompleted: boolean;
}

export interface SurveyMetricsResult {
  count: number;
  averageScore: string;
  scorePercentage: number;
}

export interface TicketCommentInput {
  body: string;
}

export interface TicketTagInput {
  name: string;
  color: string;
}

export interface TicketAssignmentRuleEntryInput {
  id: string;
  sortOrder: number;
  routingMethod: string;
  routingUserIds: string[];
  lastAssignedIndex: number;
  criteria: CriteriaCondition[];
}

export interface TicketRoutingMatchResult {
  matchedEntryId: string;
  newAssignedToId: string;
  newLastAssignedIndex: number;
}

export interface TicketEscalationRuleInput {
  id: string;
  name: string;
  triggerType: string;
  timeThresholdMinutes: number;
  escalateToId: string;
  newPriority: string | null;
  isActive: number;
}

export interface TicketMilestoneInput {
  id: string;
  milestoneType: string;
  targetTime: Date;
  status: string;
  completedAt: Date | null;
}

export interface TicketEscalationResult {
  ruleId: string;
  escalateToId: string;
  newPriority: string | null;
  reason: string;
}

export interface TicketMacroInput {
  id: string;
  orgId: string;
  name: string;
  cannedResponse: string;
  updateStatus: string | null;
  updatePriority: string | null;
}

export interface TicketMacroApplyInput {
  ticket: {
    id: string;
    orgId: string;
    status: string;
    priority: string;
  };
  macro: TicketMacroInput;
}

export interface TicketMacroApplyResult {
  updatedStatus: string;
  updatedPriority: string;
  commentBody: string;
  auditMessage: string;
}

export interface TicketMacroValidationInput {
  name: string;
  cannedResponse: string;
}

export interface AgentCSATMetricsInput {
  agentId: string;
  tickets: {
    id: string;
    assignedToId: string | null;
    status: string;
    createdAt: Date;
    resolvedAt?: Date | null;
  }[];
  responses: {
    ticketId: string | null;
    score: number;
  }[];
}

export interface AgentCSATMetricsResult {
  totalTickets: number;
  resolvedTickets: number;
  averageCsat: string;
  satisfactionRate: number;
  averageResolutionTimeMinutes: number;
}

export interface CSATFeedbackInput {
  score: number;
  comment?: string | null;
}

export interface CSVColumnMapping {
  [entityField: string]: string;
}

export interface CSVImportInput {
  entityType: "lead" | "contact";
  csvContent: string;
  mapping: CSVColumnMapping;
  dryRun: boolean;
}

export interface RowValidationError {
  row: number;
  column: string;
  message: string;
}

export interface CSVValidationResult {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  errors: RowValidationError[];
}

export interface DBSchemaMigration {
  id: string;
  orgId: string;
  version: number;
  name: string;
  appliedAt: Date;
}

export interface DBStoreMigration {
  version: number;
  name: string;
  up: (store: Record<string, unknown[]>, orgId: string) => Promise<void>;
  down: (store: Record<string, unknown[]>, orgId: string) => Promise<void>;
}

export interface CoreScheduledReport {
  id: string;
  orgId: string;
  reportId: string;
  recipientEmail: string;
  frequency: "daily" | "weekly" | "monthly";
  nextRunAt: Date;
  isActive: number;
  createdAt: Date;
}

export interface CoreScheduledReportRun {
  id: string;
  orgId: string;
  scheduledReportId: string;
  status: "success" | "failed";
  errorMessage: string | null;
  runAt: Date;
}

export interface CoreReportRunResult {
  reportName: string;
  groupBy: string;
  aggregateFunc: "count" | "sum" | "avg";
  aggregateField: string | null;
  data: { group: string; value: number }[];
}

export interface LeaderboardRepInput {
  userId: string;
  userName: string;
}

export interface LeaderboardOpportunityInput {
  id: string;
  ownerId: string;
  stage: string;
  amount: string | null;
  closeDate: Date | null;
}

export interface LeaderboardQuotaInput {
  userId: string;
  period: string;
  targetAmount: string;
}

export interface LeaderboardRepResult {
  userId: string;
  userName: string;
  totalClosedWon: number;
  quotaTarget: number;
  attainmentPercentage: number;
  rank: number;
}

export interface LeaderboardResult {
  period: string;
  leaderboard: LeaderboardRepResult[];
}

export interface ForecastAdjustmentInput {
  userId: string;
  period: string;
  amount: string;
  adjustmentType: string;
}

export interface AdjustedForecastSummaryResult {
  period: string;
  baseQuota: number;
  adjustedQuota: number;
  baseWeightedAmount: number;
  adjustedWeightedAmount: number;
  baseAttainment: number;
  adjustedAttainment: number;
}

export interface ValidationRuleInput {
  id: string;
  orgId: string;
  name: string;
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
}

export interface EmailTemplateInput {
  subject: string;
  body: string;
}

export interface CoreSequence {
  id: string;
  orgId: string;
  name: string;
  description: string;
  status: string;
  sendingWindowStart?: string | null;
  sendingWindowEnd?: string | null;
  sendingDays?: number[] | null;
  allowReenrollment?: boolean | null;
  reenrollmentMinDays?: number | null;
  dailySendLimit?: number | null;
  senderType?: string | null;
  senderUserId?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CoreSequenceStep {
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

export interface CoreSequenceMembership {
  id: string;
  orgId: string;
  sequenceId: string;
  recordType: "lead" | "contact";
  recordId: string;
  status: string;
  currentStepNumber: number;
  lastExecutedAt: Date | null;
  nextExecutionAt: Date;
  snoozeUntil: Date | null;
  snoozeReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CoreConsentPreference {
  id: string;
  orgId: string;
  recordType: string;
  recordId: string;
  channel: string;
  status: string;
  source: string;
  updatedById: string;
}

export interface CoreExitTrigger {
  id: string;
  orgId: string;
  sequenceId: string;
  triggerType: string;
  criteria: Record<string, unknown>;
  isActive: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CoreStepSplitTest {
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

export interface CoreAbAllocation {
  id: string;
  orgId: string;
  membershipId: string;
  stepId: string;
  allocatedTemplateId: string;
  createdAt: Date;
}

export interface CoreStepBranch {
  id: string;
  orgId: string;
  stepId: string;
  branchType: string; // "email_open" | "email_click"
  evaluationWindowDays: number;
  trueNextStepNumber: number;
  falseNextStepNumber: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface CoreSequenceGoal {
  id: string;
  orgId: string;
  sequenceId: string;
  goalType: string; // "lead_status_equals" | "opportunity_created"
  targetValue: string | null;
  isActive: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CoreSequenceConversion {
  id: string;
  orgId: string;
  membershipId: string;
  sequenceId: string;
  goalId: string;
  attributedRevenue: string;
  convertedAt: Date;
  createdAt: Date;
}

export interface CoreSequenceSuppression {
  id: string;
  orgId: string;
  recordType: string;
  recordId: string | null;
  pattern: string | null;
  reason: string;
  createdAt: Date;
}

export interface CoreSequenceExclusion {
  id: string;
  orgId: string;
  sequenceId: string;
  exclusionType: string;
  exclusionValue: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CoreActivity {
  id: string;
  orgId: string;
  creatorId: string;
  type: string;
  subject: string;
  body: string | null;
  dueDate: Date | null;
  createdAt: Date;
  custom?: Record<string, unknown> | null;
}

export interface CoreActivityLink {
  id: string;
  orgId: string;
  activityId: string;
  targetType: string;
  targetId: string;
}

export interface CoreEmailTracker {
  id: string;
  activityId: string;
  openCount: number;
  clickCount: number;
}

export interface StepAnalytics {
  stepNumber: number;
  templateId: string | null;
  sentCount: number;
  openCount: number;
  clickCount: number;
  openRate: string;
  clickRate: string;
}

export interface SequenceAnalyticsResult {
  sequenceId: string;
  totalEnrolled: number;
  statusCounts: {
    active: number;
    completed: number;
    unsubscribed: number;
    error: number;
  };
  overallOpenRate: string;
  overallClickRate: string;
  steps: StepAnalytics[];
}

export interface UnsubscribeAnalyticsInput {
  unsubscribes: {
    id: string;
    reason: string;
    trackerId: string;
    orgId: string;
  }[];
  trackers: { id: string; activityId: string; orgId: string }[];
  links: { activityId: string; targetId: string; orgId: string }[];
  memberships: {
    sequenceId: string;
    recordId: string;
    status: string;
    orgId: string;
  }[];
  sequences: { id: string; name: string; orgId: string }[];
}

export interface UnsubscribeAnalyticsResult {
  totalUnsubscribes: number;
  reasonBreakdown: { reason: string; count: number; percentage: string }[];
  sequenceBreakdown: {
    sequenceId: string;
    sequenceName: string;
    count: number;
    percentage: string;
  }[];
}

export interface LinkEngagementInput {
  clicks: {
    id: string;
    trackerId: string;
    clickedUrl: string;
    orgId: string;
  }[];
  trackers: { id: string; activityId: string; orgId: string }[];
  activities: { id: string; type: string; orgId: string }[];
  activityLinks: {
    activityId: string;
    targetId: string;
    targetType: string;
    orgId: string;
  }[];
  memberships: {
    sequenceId: string;
    recordId: string;
    status: string;
    orgId: string;
  }[];
  steps: {
    id: string;
    sequenceId: string;
    stepNumber: number;
    name?: string;
    orgId: string;
  }[];
  sequenceId: string;
}

export interface LinkPerformanceMetric {
  clickedUrl: string;
  stepId: string;
  stepName: string;
  clickCount: number;
  percentage: string;
}

export interface LinkEngagementResult {
  totalTrackedClicks: number;
  linkPerformance: LinkPerformanceMetric[];
}

export interface OpenAnalyticsInput {
  opens: { id: string; trackerId: string; deviceType: string; orgId: string }[];
  trackers: { id: string; activityId: string; orgId: string }[];
  activities: { id: string; type: string; orgId: string }[];
  activityLinks: {
    id: string;
    activityId: string;
    targetId: string;
    targetType: string;
    orgId: string;
  }[];
  memberships: {
    id: string;
    sequenceId: string;
    recordId: string;
    orgId: string;
  }[];
  steps: {
    id: string;
    name?: string;
    stepNumber: number;
    sequenceId: string;
    orgId: string;
  }[];
  sequenceId: string;
}

export interface DevicePerformanceMetric {
  deviceType: string;
  openCount: number;
  percentage: string;
}

export interface StepOpenRateMetric {
  stepId: string;
  stepName: string;
  totalSent: number;
  uniqueOpens: number;
  openRate: string;
}

export interface OpenAnalyticsResult {
  totalUniqueOpens: number;
  totalTrackedOpens: number;
  devicePerformance: DevicePerformanceMetric[];
  stepOpenRates: StepOpenRateMetric[];
}

export interface ReplyAnalyticsInput {
  replies: {
    id: string;
    trackerId: string;
    sentiment: string;
    orgId: string;
  }[];
  trackers: { id: string; activityId: string; orgId: string }[];
  activities: { id: string; type: string; orgId: string }[];
  activityLinks: {
    id: string;
    activityId: string;
    targetId: string;
    targetType: string;
    orgId: string;
  }[];
  memberships: {
    id: string;
    sequenceId: string;
    recordId: string;
    orgId: string;
  }[];
  steps: {
    id: string;
    name?: string;
    stepNumber: number;
    sequenceId: string;
    orgId: string;
  }[];
  sequenceId: string;
}

export interface SentimentPerformanceMetric {
  sentiment: string;
  replyCount: number;
  percentage: string;
}

export interface StepReplyRateMetric {
  stepId: string;
  stepName: string;
  totalSent: number;
  uniqueReplies: number;
  replyRate: string;
}

export interface ReplyAnalyticsResult {
  totalUniqueReplies: number;
  totalTrackedReplies: number;
  replyRate: string;
  sentimentPerformance: SentimentPerformanceMetric[];
  stepReplyRates: StepReplyRateMetric[];
}

export interface BounceAnalyticsInput {
  bounces: {
    id: string;
    trackerId: string;
    eventType: string;
    bounceType: string;
    orgId: string;
  }[];
  trackers: { id: string; activityId: string; orgId: string }[];
  activities: {
    id: string;
    type: string;
    orgId: string;
    createdAt: Date | string;
  }[];
  activityLinks: {
    id: string;
    activityId: string;
    targetId: string;
    targetType: string;
    orgId: string;
  }[];
  memberships: {
    id: string;
    sequenceId: string;
    recordId: string;
    orgId: string;
  }[];
  steps: {
    id: string;
    name?: string;
    stepNumber: number;
    sequenceId: string;
    orgId: string;
  }[];
  sequenceId: string;
}

export interface BounceTypePerformanceMetric {
  bounceType: string;
  eventCount: number;
  percentage: string;
}

export interface StepBounceRateMetric {
  stepId: string;
  stepName: string;
  totalSent: number;
  uniqueBounces: number;
  bounceRate: string;
}

export interface BounceAnalyticsResult {
  totalBounces: number;
  totalComplaints: number;
  totalUniqueBouncedTrackers: number;
  bounceRate: string;
  bounceTypePerformance: BounceTypePerformanceMetric[];
  stepBounceRates: StepBounceRateMetric[];
}

export interface ReadTimeAnalyticsInput {
  readTimeEvents: {
    id: string;
    trackerId: string;
    durationMs: number;
    readClassification: string;
    orgId: string;
  }[];
  trackers: {
    id: string;
    activityId: string;
    openCount: number;
    orgId: string;
  }[];
  activities: {
    id: string;
    orgId: string;
    type?: string;
    createdAt?: Date | string;
  }[];
  activityLinks: {
    activityId: string;
    targetId: string;
    targetType: string;
    orgId: string;
  }[];
  memberships: {
    id: string;
    sequenceId: string;
    recordId: string;
    orgId: string;
  }[];
  steps: {
    id: string;
    name?: string;
    stepNumber: number;
    sequenceId: string;
    orgId: string;
  }[];
  sequenceId: string;
}

export interface ReadTimePerformanceMetric {
  classification: string;
  eventCount: number;
  percentage: string;
}

export interface StepReadTimeStatsMetric {
  stepId: string;
  stepName: string;
  openCount: number;
  glancedCount: number;
  skimmedCount: number;
  readCount: number;
}

export interface ReadTimeAnalyticsResult {
  totalGlanced: number;
  totalSkimmed: number;
  totalRead: number;
  averageReadTimeMs: number;
  readTimeClassificationPerformance: ReadTimePerformanceMetric[];
  stepReadTimeStats: StepReadTimeStatsMetric[];
}

export interface EngagementScoreEventsInput {
  openCount: number;
  clickCount: number;
  replyCount: number;
  readTimeEvents: { durationMs: number; readClassification: string }[];
  bounceEvents: { eventType: string; bounceType: string }[];
  isUnsubscribed: boolean;
}

export interface FolderNode {
  id: string;
  parentFolderId: string | null;
}

export interface ActivityLogEntry {
  id: string;
  type:
    | "sent"
    | "open"
    | "click"
    | "reply"
    | "bounce"
    | "complaint"
    | "read_time";
  timestamp: Date;
  // biome-ignore lint/suspicious/noExplicitAny: details contains custom untyped metadata fields
  details: Record<string, any>;
}

export interface EventRecord {
  orgId: string;
  trackerId: string;
  id: string;
  createdAt: string | Date;
  eventType?: string;
  bounceType?: string;
  bounceReason?: string;
  durationMs?: number;
  readClassification?: string;
  replyBody?: string;
  senderEmail?: string;
  sentiment?: string;
  clickedUrl?: string;
  ipAddress?: string;
  userAgent?: string;
  deviceType?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
}
