import {
  type AnyPgColumn,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

export const organizations = pgTable("organizations", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const roles = pgTable("roles", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  permissionsMask: integer("permissions_mask").notNull().default(0),
});

export const memberships = pgTable("memberships", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  roleId: uuid("role_id")
    .notNull()
    .references(() => roles.id, { onDelete: "cascade" }),
});

export const accounts = pgTable("accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  ownerId: uuid("owner_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  domain: text("domain"),
  custom: jsonb("custom"),
  parentAccountId: uuid("parent_account_id").references(
    (): AnyPgColumn => accounts.id,
    { onDelete: "set null" },
  ),
});

export const contacts = pgTable("contacts", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  ownerId: uuid("owner_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  accountId: uuid("account_id").references(() => accounts.id, {
    onDelete: "set null",
  }),
  firstName: text("first_name"),
  lastName: text("last_name"),
  email: text("email"),
  custom: jsonb("custom"),
  reportsToId: uuid("reports_to_id").references(
    (): AnyPgColumn => contacts.id,
    { onDelete: "set null" },
  ),
});

export const leads = pgTable("leads", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  ownerId: uuid("owner_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  status: text("status").notNull().default("New"),
  email: text("email"),
  company: text("company"),
  convertedAccountId: uuid("converted_account_id"),
  convertedContactId: uuid("converted_contact_id"),
  custom: jsonb("custom"),
});

export const campaigns = pgTable("campaigns", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  status: text("status").notNull().default("Planned"), // "Planned" | "Active" | "Completed" | "Aborted"
  type: text("type").notNull().default("Other"), // "Email" | "Webinar" | "Conference" | "Direct Mail" | "Other"
  isActive: integer("is_active").notNull().default(1), // 0 = inactive, 1 = active
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  budgetedCost: text("budgeted_cost").notNull().default("0.00"),
  actualCost: text("actual_cost").notNull().default("0.00"),
  expectedRevenue: text("expected_revenue").notNull().default("0.00"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const opportunities = pgTable("opportunities", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  ownerId: uuid("owner_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  accountId: uuid("account_id").references(() => accounts.id, {
    onDelete: "cascade",
  }),
  campaignId: uuid("campaign_id").references(() => campaigns.id, {
    onDelete: "set null",
  }),
  stage: text("stage").notNull().default("Prospecting"),
  amount: text("amount"), // Using text or numeric standard for dynamic representation
  closeDate: timestamp("close_date"),
  custom: jsonb("custom"),
});

export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  recordId: uuid("record_id").notNull(),
  recordType: text("record_type").notNull(),
  action: text("action").notNull(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  changes: jsonb("changes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const fieldDefinitions = pgTable("field_definitions", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  objectType: text("object_type").notNull(), // "accounts" | "contacts" | "leads"
  apiName: text("api_name").notNull(),
  label: text("label").notNull(),
  dataType: text("data_type").notNull(), // "text" | "number" | "boolean" | "picklist"
  validationRules: jsonb("validation_rules"),
});

export const layoutDefinitions = pgTable("layout_definitions", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  objectType: text("object_type").notNull(),
  sections: jsonb("sections").notNull(),
});

export const workflows = pgTable("workflows", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  triggerEvent: text("trigger_event").notNull(), // e.g. "opportunity.stage_changed"
  conditions: jsonb("conditions"),
  actions: jsonb("actions").notNull(),
});

export const webhooks = pgTable("webhooks", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  targetUrl: text("target_url").notNull(),
  secret: text("secret"),
  status: text("status").notNull().default("active"),
});

export const tickets = pgTable("tickets", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  contactId: uuid("contact_id")
    .notNull()
    .references(() => contacts.id, { onDelete: "cascade" }),
  subject: text("subject").notNull(),
  status: text("status").notNull().default("Open"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const reports = pgTable("reports", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  objectType: text("object_type").notNull(),
  groupBy: text("group_by").notNull(),
  aggregateField: text("aggregate_field"),
  aggregateFunc: text("aggregate_func").notNull().default("count"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const products = pgTable("products", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  sku: text("sku"),
  description: text("description"),
  isActive: integer("is_active").notNull().default(1),
});

export const pricebooks = pgTable("pricebooks", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  isActive: integer("is_active").notNull().default(1),
  isStandard: integer("is_standard").notNull().default(0),
});

export const pricebookEntries = pgTable("pricebook_entries", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  pricebookId: uuid("pricebook_id")
    .notNull()
    .references(() => pricebooks.id, { onDelete: "cascade" }),
  productId: uuid("product_id")
    .notNull()
    .references(() => products.id, { onDelete: "cascade" }),
  unitPrice: text("unit_price").notNull(),
  isActive: integer("is_active").notNull().default(1),
});

export const opportunityProducts = pgTable("opportunity_products", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  opportunityId: uuid("opportunity_id")
    .notNull()
    .references(() => opportunities.id, { onDelete: "cascade" }),
  pricebookEntryId: uuid("pricebook_entry_id")
    .notNull()
    .references(() => pricebookEntries.id, { onDelete: "cascade" }),
  quantity: integer("quantity").notNull(),
  unitPrice: text("unit_price").notNull(),
  totalPrice: text("total_price").notNull(),
});

export const quotas = pgTable("quotas", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  period: text("period").notNull(),
  targetAmount: text("target_amount").notNull(),
});

export const stageProbabilities = pgTable("stage_probabilities", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  stage: text("stage").notNull(),
  probability: integer("probability").notNull(),
});

export const webhookDeliveries = pgTable("webhook_deliveries", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  webhookId: uuid("webhook_id")
    .notNull()
    .references(() => webhooks.id, { onDelete: "cascade" }),
  event: text("event").notNull(),
  statusCode: integer("status_code").notNull(),
  payload: text("payload").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const documentTemplates = pgTable("document_templates", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const mergedDocuments = pgTable("merged_documents", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  templateId: uuid("template_id")
    .notNull()
    .references(() => documentTemplates.id, { onDelete: "cascade" }),
  recordType: text("record_type").notNull(),
  recordId: uuid("record_id").notNull(),
  compiledContent: text("compiled_content").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const subscriptions = pgTable("subscriptions", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  accountId: uuid("account_id")
    .notNull()
    .references(() => accounts.id, { onDelete: "cascade" }),
  planName: text("plan_name").notNull(),
  status: text("status").notNull().default("active"),
  billingPeriod: text("billing_period").notNull(), // "monthly" | "annually"
  unitPrice: text("unit_price").notNull(),
  quantity: integer("quantity").notNull().default(1),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date"),
});

export const invoices = pgTable("invoices", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  subscriptionId: uuid("subscription_id")
    .notNull()
    .references(() => subscriptions.id, { onDelete: "cascade" }),
  accountId: uuid("account_id")
    .notNull()
    .references(() => accounts.id, { onDelete: "cascade" }),
  amount: text("amount").notNull(),
  dueDate: timestamp("due_date").notNull(),
  status: text("status").notNull().default("Unpaid"), // "Unpaid" | "Paid"
});

export const webhookOutbox = pgTable("webhook_outbox", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  webhookId: uuid("webhook_id")
    .notNull()
    .references(() => webhooks.id, { onDelete: "cascade" }),
  event: text("event").notNull(),
  payload: text("payload").notNull(),
  status: text("status").notNull().default("pending"),
  attempts: integer("attempts").notNull().default(0),
  lastAttemptAt: timestamp("last_attempt_at"),
  nextAttemptAt: timestamp("next_attempt_at").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  lastError: text("last_error"),
});

export const webhookDlq = pgTable("webhook_dlq", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  webhookId: uuid("webhook_id")
    .notNull()
    .references(() => webhooks.id, { onDelete: "cascade" }),
  event: text("event").notNull(),
  payload: text("payload").notNull(),
  failedAt: timestamp("failed_at").notNull().defaultNow(),
  attempts: integer("attempts").notNull(),
  lastError: text("last_error"),
});

export const opportunityApprovals = pgTable("opportunity_approvals", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  opportunityId: uuid("opportunity_id")
    .notNull()
    .references(() => opportunities.id, { onDelete: "cascade" }),
  submitterId: uuid("submitter_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  status: text("status").notNull().default("Pending"), // "Pending" | "Approved" | "Rejected"
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const opportunityApprovalSteps = pgTable("opportunity_approval_steps", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  approvalId: uuid("approval_id")
    .notNull()
    .references(() => opportunityApprovals.id, { onDelete: "cascade" }),
  stepName: text("step_name").notNull(),
  approverRoleId: text("approver_role_id").notNull(),
  status: text("status").notNull().default("Pending"), // "Pending" | "Approved" | "Rejected"
  decidedByUserId: uuid("decided_by_user_id").references(() => users.id, {
    onDelete: "set null",
  }),
  comments: text("comments"),
  decidedAt: timestamp("decided_at"),
});

export const commissions = pgTable("commissions", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  opportunityId: uuid("opportunity_id")
    .notNull()
    .references(() => opportunities.id, { onDelete: "cascade" }),
  amount: text("amount").notNull(),
  rateApplied: text("rate_applied").notNull(),
  status: text("status").notNull().default("Pending"), // "Pending" | "Approved" | "Paid"
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const leadAssignmentRules = pgTable("lead_assignment_rules", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  isActive: integer("is_active").notNull().default(0), // 0 = inactive, 1 = active
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const leadAssignmentRuleEntries = pgTable(
  "lead_assignment_rule_entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    ruleId: uuid("rule_id")
      .notNull()
      .references(() => leadAssignmentRules.id, { onDelete: "cascade" }),
    sortOrder: integer("sort_order").notNull(),
    routingMethod: text("routing_method").notNull(), // "direct" | "round_robin"
    routingUserIds: jsonb("routing_user_ids").notNull(), // string[] (array of User UUIDs)
    lastAssignedIndex: integer("last_assigned_index").notNull().default(-1),
    criteria: jsonb("criteria").notNull(), // CriteriaCondition[]
  },
);

export const territories = pgTable("territories", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  isActive: integer("is_active").notNull().default(0), // 0 = inactive, 1 = active
  routingMethod: text("routing_method").notNull().default("direct"), // "direct" | "round_robin"
  lastAssignedIndex: integer("last_assigned_index").notNull().default(-1),
  criteria: jsonb("criteria").notNull(), // CriteriaCondition[]
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const territoryMembers = pgTable("territory_members", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  territoryId: uuid("territory_id")
    .notNull()
    .references(() => territories.id, { onDelete: "cascade" }),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  role: text("role").notNull().default("Primary"), // "Primary" | "Overlay"
});

export const opportunitySplits = pgTable("opportunity_splits", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  opportunityId: uuid("opportunity_id")
    .notNull()
    .references(() => opportunities.id, { onDelete: "cascade" }),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  percentage: integer("percentage").notNull(), // 0 to 100
  splitAmount: text("split_amount").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const campaignMembers = pgTable("campaign_members", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  campaignId: uuid("campaign_id")
    .notNull()
    .references(() => campaigns.id, { onDelete: "cascade" }),
  leadId: uuid("lead_id").references(() => leads.id, { onDelete: "cascade" }),
  contactId: uuid("contact_id").references(() => contacts.id, {
    onDelete: "cascade",
  }),
  status: text("status").notNull().default("Sent"), // "Sent" | "Responded" | "Registered"
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const opportunityStageHistory = pgTable("opportunity_stage_history", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  opportunityId: uuid("opportunity_id")
    .notNull()
    .references(() => opportunities.id, { onDelete: "cascade" }),
  fromStage: text("from_stage"),
  toStage: text("to_stage").notNull(),
  amount: text("amount"),
  changedById: uuid("changed_by_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const campaignInfluence = pgTable("campaign_influence", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  opportunityId: uuid("opportunity_id")
    .notNull()
    .references(() => opportunities.id, { onDelete: "cascade" }),
  campaignId: uuid("campaign_id")
    .notNull()
    .references(() => campaigns.id, { onDelete: "cascade" }),
  influencePercentage: integer("influence_percentage").notNull(),
  revenueShare: text("revenue_share").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const contracts = pgTable("contracts", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  accountId: uuid("account_id")
    .notNull()
    .references(() => accounts.id, { onDelete: "cascade" }),
  opportunityId: uuid("opportunity_id").references(() => opportunities.id, {
    onDelete: "set null",
  }),
  contractAmount: text("contract_amount").notNull().default("0.00"),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date").notNull(),
  status: text("status").notNull().default("Draft"), // "Draft" | "Active" | "Expired" | "Renewed"
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const leadSlaTargets = pgTable("lead_sla_targets", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  maxResponseTimeMinutes: integer("max_response_time_minutes")
    .notNull()
    .default(60),
  isActive: integer("is_active").notNull().default(1),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const leadSlaTrackers = pgTable("lead_sla_trackers", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  leadId: uuid("lead_id")
    .notNull()
    .references(() => leads.id, { onDelete: "cascade" }),
  targetId: uuid("target_id")
    .notNull()
    .references(() => leadSlaTargets.id, { onDelete: "cascade" }),
  status: text("status").notNull().default("Pending"), // "Pending" | "Met" | "Breached"
  createdAt: timestamp("created_at").notNull().defaultNow(),
  respondedAt: timestamp("responded_at"),
  responseTimeMinutes: integer("response_time_minutes"),
});

export const accountTeams = pgTable("account_teams", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  accountId: uuid("account_id")
    .notNull()
    .references(() => accounts.id, { onDelete: "cascade" }),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  role: text("role").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const leadScoringRules = pgTable("lead_scoring_rules", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  criteria: jsonb("criteria").notNull(),
  scoreValue: integer("score_value").notNull(),
  isActive: integer("is_active").notNull().default(1),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const opportunityCompetitors = pgTable("opportunity_competitors", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  opportunityId: uuid("opportunity_id")
    .notNull()
    .references(() => opportunities.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  strength: text("strength"),
  weakness: text("weakness"),
  winLossStatus: text("win_loss_status").notNull().default("Pending"), // "Pending" | "Won" | "Lost"
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const leadConversionMappings = pgTable("lead_conversion_mappings", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  sourceLeadField: text("source_lead_field").notNull(),
  targetObjectType: text("target_object_type").notNull(), // "accounts" | "contacts" | "opportunities"
  targetField: text("target_field").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
