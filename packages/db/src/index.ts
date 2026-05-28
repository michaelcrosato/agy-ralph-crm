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
}

export interface DBOpportunity {
  id: string;
  orgId: string;
  ownerId: string;
  accountId: string | null;
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

export const store = {
  leads: [] as DBLead[],
  accounts: [] as DBAccount[],
  contacts: [] as DBContact[],
  opportunities: [] as DBOpportunity[],
  auditLogs: [] as DBAuditLog[],
  fieldDefinitions: [] as DBFieldDefinition[],
  layoutDefinitions: [] as DBLayoutDefinition[],
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
        id: `account-${Math.random().toString(36).substring(2, 11)}`,
      };
      store.accounts.push(newAcc);
      return newAcc;
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
        id: `contact-${Math.random().toString(36).substring(2, 11)}`,
      };
      store.contacts.push(newContact);
      return newContact;
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
  clear: () => {
    store.leads = [];
    store.accounts = [];
    store.contacts = [];
    store.opportunities = [];
    store.auditLogs = [];
    store.fieldDefinitions = [];
    store.layoutDefinitions = [];
  },
};
