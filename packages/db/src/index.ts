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
  createdAt: Date;
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
  targetType: "Account" | "Contact" | "Lead" | "Opportunity";
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

export interface DBLeadScoringRule {
  id: string;
  orgId: string;
  name: string;
  criteria: DBCriteriaCondition[];
  scoreValue: number;
  isActive: number;
  createdAt: Date;
}

export const store = {
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
  contracts: [] as DBContract[],
  leadSlaTargets: [] as DBLeadSlaTarget[],
  leadSlaTrackers: [] as DBLeadSlaTracker[],
  accountTeams: [] as DBAccountTeamMember[],
  leadScoringRules: [] as DBLeadScoringRule[],
};

export const dbStore = {
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
    insert: async (act: Omit<DBActivity, "id" | "createdAt">) => {
      const orgId = getActiveOrgId();
      if (act.orgId !== orgId) {
        throw new Error("RLS Isolation Violation: Tenant mismatch.");
      }
      const newAct: DBActivity = {
        ...act,
        id: `activity-${Math.random().toString(36).substring(2, 11)}`,
        createdAt: new Date(),
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
  clear: () => {
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
    store.leadScoringRules = [];
  },
};
