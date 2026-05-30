import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  vector,
} from "drizzle-orm/pg-core";

const uuid = (name: string): any => {
  const builder = text(name);
  (builder as any).defaultRandom = function () {
    return this.default(sql`gen_random_uuid()`);
  };
  return builder as any;
};

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

export const accounts = pgTable(
  "accounts",
  {
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
  },
  (t) => [
    index("idx_accounts_org_owner").on(t.orgId, t.ownerId),
    index("idx_accounts_org_name").on(t.orgId, t.name),
    index("idx_accounts_parent").on(t.parentAccountId),
  ],
);

export const contacts = pgTable(
  "contacts",
  {
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
  },
  (t) => [
    index("idx_contacts_org_owner").on(t.orgId, t.ownerId),
    index("idx_contacts_org_email").on(t.orgId, t.email),
    index("idx_contacts_account").on(t.accountId),
  ],
);

export const leads = pgTable(
  "leads",
  {
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
  },
  (t) => [
    index("idx_leads_org_owner").on(t.orgId, t.ownerId),
    index("idx_leads_org_status").on(t.orgId, t.status),
    index("idx_leads_org_email").on(t.orgId, t.email),
  ],
);

export const campaigns = pgTable(
  "campaigns",
  {
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
    utmSource: text("utm_source"),
    utmMedium: text("utm_medium"),
    utmCampaign: text("utm_campaign"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("idx_campaigns_org_status").on(t.orgId, t.status),
    index("idx_campaigns_org_active").on(t.orgId, t.isActive),
  ],
);

export const opportunities = pgTable(
  "opportunities",
  {
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
    name: text("name").notNull().default(""),
    amount: text("amount"), // Using text or numeric standard for dynamic representation
    closeDate: timestamp("close_date"),
    custom: jsonb("custom"),
    currencyCode: text("currency_code").notNull().default("USD"),
    amountCorporate: text("amount_corporate"),
  },
  (t) => [
    index("idx_opportunities_org_owner").on(t.orgId, t.ownerId),
    index("idx_opportunities_org_stage").on(t.orgId, t.stage),
    index("idx_opportunities_org_close_date").on(t.orgId, t.closeDate),
    index("idx_opportunities_account").on(t.accountId),
  ],
);

export const auditLogs = pgTable(
  "audit_logs",
  {
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
  },
  (t) => [
    index("idx_audit_logs_org_created").on(t.orgId, t.createdAt),
    index("idx_audit_logs_record").on(t.recordType, t.recordId),
  ],
);

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

export const tickets = pgTable(
  "tickets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    contactId: uuid("contact_id")
      .notNull()
      .references(() => contacts.id, { onDelete: "cascade" }),
    subject: text("subject").notNull(),
    status: text("status").notNull().default("Open"),
    priority: text("priority").notNull().default("Medium"),
    assignedToId: uuid("assigned_to_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("idx_tickets_org_created").on(t.orgId, t.createdAt),
    index("idx_tickets_org_status").on(t.orgId, t.status),
    index("idx_tickets_org_priority").on(t.orgId, t.priority),
    index("idx_tickets_assigned").on(t.assignedToId),
  ],
);

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

export const webhookOutbox = pgTable(
  "webhook_outbox",
  {
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
  },
  (t) => [
    index("idx_webhook_outbox_org_created").on(t.orgId, t.createdAt),
    index("idx_webhook_outbox_pending")
      .on(t.status)
      .where(sql`status = 'pending'`),
  ],
);

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

export const currencies = pgTable("currencies", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  isoCode: text("iso_code").notNull(),
  displayName: text("display_name").notNull(),
  symbol: text("symbol").notNull(),
  exchangeRate: text("exchange_rate").notNull(),
  isCorporate: boolean("is_corporate").notNull().default(false),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const opportunityStageGates = pgTable("opportunity_stage_gates", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  targetStage: text("target_stage").notNull(),
  field: text("field").notNull(),
  operator: text("operator").notNull(),
  expectedValue: text("expected_value"),
  errorMessage: text("error_message").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const stageGuidance = pgTable("stage_guidance", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  objectType: text("object_type").notNull(), // "opportunities" | "leads"
  stage: text("stage").notNull(),
  keyFields: jsonb("key_fields").notNull(), // string[] (array of field names)
  guidanceText: text("guidance_text").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const opportunityTeams = pgTable("opportunity_teams", {
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
  role: text("role").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const opportunityProductSchedules = pgTable(
  "opportunity_product_schedules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    opportunityProductId: uuid("opportunity_product_id")
      .notNull()
      .references(() => opportunityProducts.id, { onDelete: "cascade" }),
    scheduleType: text("schedule_type").notNull(), // "revenue" | "quantity"
    scheduleDate: timestamp("schedule_date").notNull(),
    amount: text("amount").notNull(),
    description: text("description"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
);

export const leadAutoConversionRules = pgTable("lead_auto_conversion_rules", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  isActive: integer("is_active").notNull().default(1),
  createOpportunity: integer("create_opportunity").notNull().default(1),
  opportunityStage: text("opportunity_stage")
    .notNull()
    .default("Qualification"),
  criteria: jsonb("criteria").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const opportunityStageDurationRules = pgTable(
  "opportunity_stage_duration_rules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    stage: text("stage").notNull(),
    maxDaysAllowed: integer("max_days_allowed").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
);

export const contactConsentPreferences = pgTable(
  "contact_consent_preferences",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    recordType: text("record_type").notNull(), // "lead" | "contact"
    recordId: uuid("record_id").notNull(), // UUID reference to Lead or Contact
    channel: text("channel").notNull(), // "email" | "sms" | "phone"
    status: text("status").notNull().default("pending"), // "opt_in" | "opt_out" | "pending"
    source: text("source").notNull(), // e.g. "web_form", "manual", "api"
    updatedById: uuid("updated_by_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
);

export const emailCalendarSyncSettings = pgTable(
  "email_calendar_sync_settings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(), // "google" | "outlook" | "mock"
    isActive: boolean("is_active").notNull().default(true),
    syncEmails: boolean("sync_emails").notNull().default(true),
    syncCalendar: boolean("sync_calendar").notNull().default(true),
    lastSyncedAt: timestamp("last_synced_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
);

export const emailCalendarSyncRuns = pgTable("email_calendar_sync_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  settingsId: uuid("settings_id")
    .notNull()
    .references(() => emailCalendarSyncSettings.id, { onDelete: "cascade" }),
  status: text("status").notNull().default("success"), // "success" | "failed"
  emailsSyncedCount: integer("emails_synced_count").notNull().default(0),
  eventsSyncedCount: integer("events_synced_count").notNull().default(0),
  errorMessage: text("error_message"),
  startedAt: timestamp("started_at").notNull().defaultNow(),
  completedAt: timestamp("completed_at").notNull().defaultNow(),
});

export const esignatureRequests = pgTable("esignature_requests", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  documentName: text("document_name").notNull(),
  signerEmail: text("signer_email").notNull(),
  status: text("status").notNull().default("sent"), // "sent" | "viewed" | "signed" | "declined"
  opportunityId: uuid("opportunity_id").references(() => opportunities.id, {
    onDelete: "cascade",
  }),
  contractId: uuid("contract_id").references(() => contracts.id, {
    onDelete: "cascade",
  }),
  sentAt: timestamp("sent_at").notNull().defaultNow(),
  completedAt: timestamp("completed_at"),
});

export const surveys = pgTable("surveys", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  type: text("type").notNull(), // "csat" | "nps"
  status: text("status").notNull().default("draft"), // "draft" | "active" | "closed"
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const surveyResponses = pgTable("survey_responses", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  surveyId: uuid("survey_id")
    .notNull()
    .references(() => surveys.id, { onDelete: "cascade" }),
  contactId: uuid("contact_id").references(() => contacts.id, {
    onDelete: "set null",
  }),
  ticketId: uuid("ticket_id").references(() => tickets.id, {
    onDelete: "set null",
  }),
  score: integer("score").notNull(),
  comment: text("comment"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const slaPolicies = pgTable("sla_policies", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  priority: text("priority").notNull(), // "high" | "medium" | "low"
  responseTimeLimitMinutes: integer("response_time_limit_minutes").notNull(),
  resolutionTimeLimitMinutes: integer(
    "resolution_time_limit_minutes",
  ).notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const ticketMilestones = pgTable("ticket_milestones", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  ticketId: uuid("ticket_id")
    .notNull()
    .references(() => tickets.id, { onDelete: "cascade" }),
  milestoneType: text("milestone_type").notNull(), // "first_response" | "resolution"
  targetTime: timestamp("target_time").notNull(),
  completedAt: timestamp("completed_at"),
  status: text("status").notNull().default("pending"), // "pending" | "completed" | "breached"
  isMet: boolean("is_met"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const kbCategories = pgTable("kb_categories", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const kbArticles = pgTable("kb_articles", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  categoryId: uuid("category_id")
    .notNull()
    .references(() => kbCategories.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  content: text("content").notNull(),
  status: text("status").notNull().default("Draft"), // "Draft" | "Published"
  viewCount: integer("view_count").notNull().default(0),
  authorId: uuid("author_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const ticketComments = pgTable("ticket_comments", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  ticketId: uuid("ticket_id")
    .notNull()
    .references(() => tickets.id, { onDelete: "cascade" }),
  authorId: uuid("author_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  body: text("body").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const ticketTags = pgTable("ticket_tags", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  color: text("color").notNull().default("#808080"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const ticketTagLinks = pgTable("ticket_tag_links", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  ticketId: uuid("ticket_id")
    .notNull()
    .references(() => tickets.id, { onDelete: "cascade" }),
  tagId: uuid("tag_id")
    .notNull()
    .references(() => ticketTags.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const ticketAssignmentRules = pgTable("ticket_assignment_rules", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  isActive: integer("is_active").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const ticketAssignmentRuleEntries = pgTable(
  "ticket_assignment_rule_entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    ruleId: uuid("rule_id")
      .notNull()
      .references(() => ticketAssignmentRules.id, { onDelete: "cascade" }),
    sortOrder: integer("sort_order").notNull(),
    routingMethod: text("routing_method").notNull(), // "direct" | "round_robin"
    routingUserIds: jsonb("routing_user_ids").notNull(), // string[]
    lastAssignedIndex: integer("last_assigned_index").notNull().default(-1),
    criteria: jsonb("criteria").notNull(), // CriteriaCondition[]
  },
);

export const ticketEscalationRules = pgTable("ticket_escalation_rules", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  triggerType: text("trigger_type").notNull(), // "milestone_approaching" | "milestone_breached"
  timeThresholdMinutes: integer("time_threshold_minutes").notNull().default(0),
  escalateToId: uuid("escalate_to_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  newPriority: text("new_priority"), // "High" | "Urgent"
  isActive: integer("is_active").notNull().default(1), // 0 = inactive, 1 = active
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const ticketEscalations = pgTable("ticket_escalations", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  ticketId: uuid("ticket_id")
    .notNull()
    .references(() => tickets.id, { onDelete: "cascade" }),
  ruleId: uuid("rule_id").references(() => ticketEscalationRules.id, {
    onDelete: "set null",
  }),
  previousAssignedToId: uuid("previous_assigned_to_id").references(
    () => users.id,
    {
      onDelete: "set null",
    },
  ),
  escalatedToId: uuid("escalated_to_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  previousPriority: text("previous_priority"),
  newPriority: text("new_priority"),
  reason: text("reason").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const ticketMacros = pgTable("ticket_macros", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  cannedResponse: text("canned_response").notNull(),
  updateStatus: text("update_status"),
  updatePriority: text("update_priority"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const schemaMigrations = pgTable("schema_migrations", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  version: integer("version").notNull(),
  name: text("name").notNull(),
  appliedAt: timestamp("applied_at").notNull().defaultNow(),
});

export const scheduledReports = pgTable("scheduled_reports", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  reportId: uuid("report_id")
    .notNull()
    .references(() => reports.id, { onDelete: "cascade" }),
  recipientEmail: text("recipient_email").notNull(),
  frequency: text("frequency").notNull(), // "daily" | "weekly" | "monthly"
  nextRunAt: timestamp("next_run_at").notNull().defaultNow(),
  isActive: integer("is_active").notNull().default(1),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const scheduledReportRuns = pgTable("scheduled_report_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  scheduledReportId: uuid("scheduled_report_id")
    .notNull()
    .references(() => scheduledReports.id, { onDelete: "cascade" }),
  status: text("status").notNull().default("success"), // "success" | "failed"
  errorMessage: text("error_message"),
  runAt: timestamp("run_at").notNull().defaultNow(),
});

export const forecastAdjustments = pgTable("forecast_adjustments", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  adjustedByUserId: uuid("adjusted_by_user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  period: text("period").notNull(), // e.g. "2026-05"
  amount: text("amount").notNull(),
  adjustmentType: text("adjustment_type").notNull(), // "override_quota" | "override_weighted" | "manager_adjustment"
  comments: text("comments"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const stageForecastMappings = pgTable("stage_forecast_mappings", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  stage: text("stage").notNull(),
  forecastCategory: text("forecast_category").notNull(), // "Omitted" | "Pipeline" | "Best Case" | "Commit" | "Closed"
});

export const picklistDependencies = pgTable("picklist_dependencies", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  objectType: text("object_type").notNull(), // "accounts" | "contacts" | "leads" | "opportunities"
  parentField: text("parent_field").notNull(),
  dependentField: text("dependent_field").notNull(),
  dependencyMap: jsonb("dependency_map").notNull(), // Record<string, string[]> mapping parent options to allowed child options
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const validationRules = pgTable("validation_rules", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  objectType: text("object_type").notNull(), // "leads" | "accounts" | "contacts" | "opportunities"
  errorMessage: text("error_message").notNull(),
  criteria: jsonb("criteria").notNull(), // CriteriaCondition[]
  isActive: integer("is_active").notNull().default(1), // 0 = inactive, 1 = active
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const emailTemplates = pgTable("email_templates", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  subject: text("subject").notNull(),
  body: text("body").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const emailTrackers = pgTable(
  "email_trackers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    activityId: uuid("activity_id").notNull(),
    token: text("token").notNull().unique(),
    openCount: integer("open_count").notNull().default(0),
    clickCount: integer("click_count").notNull().default(0),
    replyCount: integer("reply_count").notNull().default(0),
    bounceCount: integer("bounce_count").notNull().default(0),
    lastOpenedAt: timestamp("last_opened_at"),
    lastClickedAt: timestamp("last_clicked_at"),
    lastRepliedAt: timestamp("last_replied_at"),
    lastBouncedAt: timestamp("last_bounced_at"),
    totalReadTimeMs: integer("total_read_time_ms").notNull().default(0),
    lastReadClassification: text("last_read_classification"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    index("idx_email_trackers_org_created").on(t.orgId, t.createdAt),
    index("idx_email_trackers_activity").on(t.activityId),
  ],
);

export const marketingSequenceFolders = pgTable("marketing_sequence_folders", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  parentFolderId: uuid("parent_folder_id").references(
    (): AnyPgColumn => marketingSequenceFolders.id,
    { onDelete: "set null" },
  ),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const marketingSequences = pgTable("marketing_sequences", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  status: text("status").notNull().default("draft"),
  sendingWindowStart: text("sending_window_start"),
  sendingWindowEnd: text("sending_window_end"),
  sendingDays: jsonb("sending_days"),
  allowReenrollment: boolean("allow_reenrollment").notNull().default(false),
  reenrollmentMinDays: integer("reenrollment_min_days"),
  dailySendLimit: integer("daily_send_limit"),
  senderType: text("sender_type").notNull().default("system"),
  senderUserId: uuid("sender_user_id").references(() => users.id, {
    onDelete: "set null",
  }),
  folderId: uuid("folder_id").references(() => marketingSequenceFolders.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const marketingSequenceSteps = pgTable(
  "marketing_sequence_steps",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    sequenceId: uuid("sequence_id")
      .notNull()
      .references(() => marketingSequences.id, { onDelete: "cascade" }),
    stepNumber: integer("step_number").notNull(),
    delayDays: integer("delay_days").notNull().default(0),
    templateId: uuid("template_id").references(() => emailTemplates.id, {
      onDelete: "cascade",
    }),
    waitCondition: jsonb("wait_condition"),
    replyToStepNumber: integer("reply_to_step_number"),
    stepType: text("step_type").notNull().default("email"),
    webhookUrl: text("webhook_url"),
    webhookPayload: text("webhook_payload"),
    taskSubject: text("task_subject"),
    taskBody: text("task_body"),
    taskDueDays: integer("task_due_days"),
    smsMessage: text("sms_message"),
    callScript: text("call_script"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    index("idx_seq_steps_org_created").on(t.orgId, t.createdAt),
    index("idx_seq_steps_org_seq").on(t.orgId, t.sequenceId),
  ],
);

export const marketingSequenceMemberships = pgTable(
  "marketing_sequence_memberships",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    sequenceId: uuid("sequence_id")
      .notNull()
      .references(() => marketingSequences.id, { onDelete: "cascade" }),
    recordType: text("record_type").notNull(), // "lead" | "contact"
    recordId: uuid("record_id").notNull(),
    status: text("status").notNull().default("active"), // "active" | "completed" | "unsubscribed" | "error"
    currentStepNumber: integer("current_step_number").notNull().default(0),
    engagementScore: integer("engagement_score").notNull().default(0),
    lastExecutedAt: timestamp("last_executed_at"),
    nextExecutionAt: timestamp("next_execution_at").notNull().defaultNow(),
    snoozeUntil: timestamp("snooze_until"),
    snoozeReason: text("snooze_reason"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    index("idx_seq_members_org_created").on(t.orgId, t.createdAt),
    index("idx_seq_members_org_seq").on(t.orgId, t.sequenceId),
    index("idx_seq_members_record").on(t.recordType, t.recordId),
  ],
);

export const marketingSegments = pgTable("marketing_segments", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  objectType: text("object_type").notNull(), // "lead" | "contact"
  criteria: jsonb("criteria").notNull(), // CriteriaCondition[]
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const marketingSequenceExitTriggers = pgTable(
  "marketing_sequence_exit_triggers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    sequenceId: uuid("sequence_id")
      .notNull()
      .references(() => marketingSequences.id, { onDelete: "cascade" }),
    triggerType: text("trigger_type").notNull(), // "lead_status_changed" | "opportunity_stage_changed"
    criteria: jsonb("criteria").notNull(),
    isActive: integer("is_active").notNull().default(1), // 0 = inactive, 1 = active
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
);

export const marketingSequenceStepSplitTests = pgTable(
  "marketing_sequence_step_split_tests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    stepId: uuid("step_id")
      .notNull()
      .references(() => marketingSequenceSteps.id, { onDelete: "cascade" }),
    variantTemplateId: uuid("variant_template_id")
      .notNull()
      .references(() => emailTemplates.id, { onDelete: "cascade" }),
    splitWeight: integer("split_weight").notNull().default(50),
    isActive: integer("is_active").notNull().default(1),
    autoPromoteWinner: integer("auto_promote_winner").notNull().default(0),
    minSendsToEvaluate: integer("min_sends_to_evaluate").notNull().default(10),
    evaluationMetric: text("evaluation_metric").notNull().default("open_rate"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
);

export const marketingSequenceAbAllocations = pgTable(
  "marketing_sequence_ab_allocations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    membershipId: uuid("membership_id")
      .notNull()
      .references(() => marketingSequenceMemberships.id, {
        onDelete: "cascade",
      }),
    stepId: uuid("step_id")
      .notNull()
      .references(() => marketingSequenceSteps.id, { onDelete: "cascade" }),
    allocatedTemplateId: uuid("allocated_template_id")
      .notNull()
      .references(() => emailTemplates.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
);

export const marketingSequenceStepBranches = pgTable(
  "marketing_sequence_step_branches",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    stepId: uuid("step_id")
      .notNull()
      .references(() => marketingSequenceSteps.id, { onDelete: "cascade" }),
    branchType: text("branch_type").notNull(), // "email_open" | "email_click"
    evaluationWindowDays: integer("evaluation_window_days")
      .notNull()
      .default(3),
    trueNextStepNumber: integer("true_next_step_number").notNull(),
    falseNextStepNumber: integer("false_next_step_number").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
);

export const marketingSequenceGoals = pgTable("marketing_sequence_goals", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  sequenceId: uuid("sequence_id")
    .notNull()
    .references(() => marketingSequences.id, { onDelete: "cascade" }),
  goalType: text("goal_type").notNull(), // "lead_status_equals" | "opportunity_created"
  targetValue: text("target_value"), // e.g. "Qualified"
  isActive: integer("is_active").notNull().default(1),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const marketingSequenceConversions = pgTable(
  "marketing_sequence_conversions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    membershipId: uuid("membership_id")
      .notNull()
      .references(() => marketingSequenceMemberships.id, {
        onDelete: "cascade",
      }),
    sequenceId: uuid("sequence_id")
      .notNull()
      .references(() => marketingSequences.id, { onDelete: "cascade" }),
    goalId: uuid("goal_id")
      .notNull()
      .references(() => marketingSequenceGoals.id, { onDelete: "cascade" }),
    attributedRevenue: text("attributed_revenue").notNull().default("0.00"),
    convertedAt: timestamp("converted_at").notNull().defaultNow(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
);

export const marketingSequenceSuppressions = pgTable(
  "marketing_sequence_suppressions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    recordType: text("record_type").notNull(), // "lead" | "contact" | "email_domain"
    recordId: uuid("record_id"), // optional reference
    pattern: text("pattern"), // e.g. "competitor.com", "user@domain.com"
    reason: text("reason").notNull().default("opt_out"), // "opt_out" | "competitor" | "bounce" | "complaint"
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
);

export const marketingSequenceExclusions = pgTable(
  "marketing_sequence_exclusions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    sequenceId: uuid("sequence_id")
      .notNull()
      .references(() => marketingSequences.id, { onDelete: "cascade" }),
    exclusionType: text("exclusion_type").notNull(), // "domain" | "segment" | "email"
    exclusionValue: text("exclusion_value").notNull(), // e.g. "competitor.com", segmentId, "opt@out.com"
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
);

export const marketingSequenceCaps = pgTable("marketing_sequence_caps", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  domainThrottleLimit: integer("domain_throttle_limit").notNull().default(5),
  recipientFrequencyCap: integer("recipient_frequency_cap")
    .notNull()
    .default(3),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const marketingSequenceLinkActions = pgTable(
  "marketing_sequence_link_actions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    stepId: uuid("step_id")
      .notNull()
      .references(() => marketingSequenceSteps.id, { onDelete: "cascade" }),
    targetUrl: text("target_url").notNull(),
    actionType: text("action_type").notNull(),
    actionConfig: jsonb("action_config").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
);

export const marketingSequenceOpenActions = pgTable(
  "marketing_sequence_open_actions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    stepId: uuid("step_id")
      .notNull()
      .references(() => marketingSequenceSteps.id, { onDelete: "cascade" }),
    actionType: text("action_type").notNull(),
    actionConfig: jsonb("action_config").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
);

export const marketingSequenceReplyActions = pgTable(
  "marketing_sequence_reply_actions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    stepId: uuid("step_id")
      .notNull()
      .references(() => marketingSequenceSteps.id, { onDelete: "cascade" }),
    actionType: text("action_type").notNull(), // 'field_update' | 'create_task'
    actionConfig: jsonb("action_config").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
);

export const emailClickEvents = pgTable("email_click_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  trackerId: uuid("tracker_id")
    .notNull()
    .references(() => emailTrackers.id, { onDelete: "cascade" }),
  clickedUrl: text("clicked_url").notNull(),
  ipAddress: text("ip_address").notNull(),
  userAgent: text("user_agent").notNull(),
  utmSource: text("utm_source"),
  utmMedium: text("utm_medium"),
  utmCampaign: text("utm_campaign"),
  utmTerm: text("utm_term"),
  utmContent: text("utm_content"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const emailUnsubscribes = pgTable("email_unsubscribes", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  trackerId: uuid("tracker_id")
    .notNull()
    .references(() => emailTrackers.id, { onDelete: "cascade" }),
  reason: text("reason").notNull(),
  feedback: text("feedback"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const emailOpenEvents = pgTable("email_open_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  trackerId: uuid("tracker_id")
    .notNull()
    .references(() => emailTrackers.id, { onDelete: "cascade" }),
  ipAddress: text("ip_address").notNull(),
  userAgent: text("user_agent").notNull(),
  deviceType: text("device_type").notNull().default("desktop"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const emailReplyEvents = pgTable("email_reply_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  trackerId: uuid("tracker_id")
    .notNull()
    .references(() => emailTrackers.id, { onDelete: "cascade" }),
  replyBody: text("reply_body"),
  senderEmail: text("sender_email").notNull(),
  sentiment: text("sentiment").notNull().default("neutral"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const emailBounceEvents = pgTable("email_bounce_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  trackerId: uuid("tracker_id")
    .notNull()
    .references(() => emailTrackers.id, { onDelete: "cascade" }),
  eventType: text("event_type").notNull(), // 'bounce' | 'complaint'
  bounceType: text("bounce_type").notNull().default("hard"), // 'hard' | 'soft' | 'spam_complaint'
  bounceReason: text("bounce_reason"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const emailReadTimeEvents = pgTable("email_read_time_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  trackerId: uuid("tracker_id")
    .notNull()
    .references(() => emailTrackers.id, { onDelete: "cascade" }),
  durationMs: integer("duration_ms").notNull(),
  readClassification: text("read_classification").notNull(), // 'glanced' | 'skimmed' | 'read'
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const marketingSequenceGlobalVariables = pgTable(
  "marketing_sequence_global_variables",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    value: text("value").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
);

export const marketingSequenceTags = pgTable("marketing_sequence_tags", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  color: text("color").notNull().default("#cccccc"), // Hex color code
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const marketingSequenceTagMappings = pgTable(
  "marketing_sequence_tag_mappings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    sequenceId: uuid("sequence_id")
      .notNull()
      .references(() => marketingSequences.id, { onDelete: "cascade" }),
    tagId: uuid("tag_id")
      .notNull()
      .references(() => marketingSequenceTags.id, { onDelete: "cascade" }),
  },
);

export const customEntityTypes = pgTable(
  "custom_entity_types",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    fieldsJson: jsonb("fields_json").notNull(), // list of CustomFieldSpec
  },
  (t) => [index("idx_custom_entity_types_org_name").on(t.orgId, t.name)],
);

export const customEntityRecords = pgTable(
  "custom_entity_records",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    typeId: uuid("type_id")
      .notNull()
      .references(() => customEntityTypes.id, { onDelete: "cascade" }),
    data: jsonb("data").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    index("idx_custom_entity_records_org_type").on(t.orgId, t.typeId),
    index("idx_custom_entity_records_created").on(t.createdAt),
  ],
);

export const embeddings = pgTable(
  "embeddings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    entityType: text("entity_type").notNull(), // 'Lead' | 'Account' | 'Contact' | 'Opportunity' | 'Ticket'
    entityId: text("entity_id").notNull(),
    embedding: vector("embedding", { dimensions: 1536 }).notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("idx_embeddings_org_entity").on(t.orgId, t.entityType, t.entityId),
    index("idx_embeddings_vector").using(
      "hnsw",
      t.embedding.op("vector_cosine_ops"),
    ),
  ],
);
