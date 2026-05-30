import { createSessionToken } from "@crm/auth";
import { dbStore, mockDb, pgDb, withTenant } from "@crm/db";
import { sql } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import app from "../../../apps/api/src/index";
import { getTestPgContainer } from "./pg-container";

const backends = [
  {
    name: "mock",
    setup: async () => {
      process.env.DB_DRIVER = "mock";
    },
  },
  {
    name: "postgres",
    setup: async () => {
      const { connectionString } = await getTestPgContainer();
      process.env.DB_DRIVER = "pg";
      process.env.DB_URL = connectionString;
    },
  },
];

describe.each(
  backends,
)("Lead REST API and Multi-Tenant RLS Store Tests on $name backend", ({
  setup,
}) => {
  let tokenTenantA: string;
  let tokenTenantB: string;

  const orgA = "org-tenant-a";
  const orgB = "org-tenant-b";

  beforeEach(async () => {
    await setup();
    await dbStore.clear();

    // Insert organizations to satisfy PostgreSQL foreign key constraints
    if (process.env.DB_DRIVER === "pg") {
      await pgDb.execute(
        sql.raw(
          `INSERT INTO "organizations" ("id", "name", "status") VALUES ('${orgA}', 'Tenant A', 'active'), ('${orgB}', 'Tenant B', 'active') ON CONFLICT DO NOTHING`,
        ),
      );
      await pgDb.execute(
        sql.raw(
          `INSERT INTO "users" ("id", "email", "password_hash", "status") VALUES ('user-a', 'user-a@example.com', 'hash', 'active'), ('user-b', 'user-b@example.com', 'hash', 'active') ON CONFLICT DO NOTHING`,
        ),
      );
    }

    // Generate tokens for isolation testing
    tokenTenantA = await createSessionToken({
      userId: "user-a",
      orgId: orgA,
      roleId: "role-a",
      permissionsMask: 7,
    });

    tokenTenantB = await createSessionToken({
      userId: "user-b",
      orgId: orgB,
      roleId: "role-b",
      permissionsMask: 7,
    });
  }, 60000);

  it("should reject non-authenticated API requests with 401", async () => {
    const res = await app.request("/api/leads", {
      method: "GET",
    });
    expect(res.status).toBe(401);
  });

  it("should reject requests with malformed tokens with 401", async () => {
    const res = await app.request("/api/leads", {
      method: "GET",
      headers: {
        Authorization: "Bearer invalid-token",
      },
    });
    expect(res.status).toBe(401);
  });

  it("should support creating and retrieving leads under correct tenant isolation", async () => {
    // 1. Tenant A creates a Lead
    const createRes = await app.request("/api/leads", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenTenantA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: "alice@company-a.com",
        company: "Company A",
        status: "New",
        custom: { industry: "Tech" },
      }),
    });

    expect(createRes.status).toBe(200);
    const createBody = await createRes.json();
    expect(createBody.success).toBe(true);
    expect(createBody.data.id).toBeDefined();
    expect(createBody.data.orgId).toBe(orgA);
    expect(createBody.data.email).toBe("alice@company-a.com");
    expect(createBody.data.custom).toEqual({ industry: "Tech" });

    const leadId = createBody.data.id;

    // 2. Tenant B tries to retrieve Tenant A's lead -> Denied (404 because not found or RLS error)
    const retrieveResB = await app.request(`/api/leads/${leadId}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${tokenTenantB}`,
      },
    });
    // With active RLS verification, Tenant B cannot locate Tenant A's lead
    expect(retrieveResB.status).toBe(404);

    // 3. Tenant A retrieves their own lead -> Successful
    const retrieveResA = await app.request(`/api/leads/${leadId}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${tokenTenantA}`,
      },
    });
    expect(retrieveResA.status).toBe(200);
    const retrieveBodyA = await retrieveResA.json();
    expect(retrieveBodyA.success).toBe(true);
    expect(retrieveBodyA.data.id).toBe(leadId);

    // 4. Tenant A lists leads -> returns 1 lead
    const listResA = await app.request("/api/leads", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${tokenTenantA}`,
      },
    });
    expect(listResA.status).toBe(200);
    const listBodyA = await listResA.json();
    expect(listBodyA.data.length).toBe(1);

    // 5. Tenant B lists leads -> returns empty array
    const listResB = await app.request("/api/leads", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${tokenTenantB}`,
      },
    });
    expect(listResB.status).toBe(200);
    const listBodyB = await listResB.json();
    expect(listBodyB.data.length).toBe(0);
  });

  it("should dynamically convert a Lead, creating Account, Contact, and Opportunity inside a single RLS session", async () => {
    // 1. Create a lead first
    const createRes = await app.request("/api/leads", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenTenantA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: "bob.smith@acme.com",
        company: "Acme Enterprise",
        status: "New",
      }),
    });

    const createBody = await createRes.json();
    const leadId = createBody.data.id;

    // 2. Perform Lead Conversion via API
    const convertRes = await app.request(`/api/leads/${leadId}/convert`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenTenantA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        opportunityName: "Acme Big Deal",
        opportunityAmount: "120000",
      }),
    });

    expect(convertRes.status).toBe(200);
    const convertBody = await convertRes.json();
    expect(convertBody.success).toBe(true);
    expect(convertBody.accountId).toBeDefined();
    expect(convertBody.contactId).toBeDefined();
    expect(convertBody.opportunityId).toBeDefined();

    // 3. Verify Lead status is Converted
    const retrieveRes = await app.request(`/api/leads/${leadId}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${tokenTenantA}`,
      },
    });
    const retrieveBody = await retrieveRes.json();
    expect(retrieveBody.data.status).toBe("Converted");
    expect(retrieveBody.data.convertedAccountId).toBe(convertBody.accountId);
    expect(retrieveBody.data.convertedContactId).toBe(convertBody.contactId);

    // 4. Verify Account, Contact, and Opportunity were persisted correctly under tenant orgA
    // We check via RLS store directly inside a tenant block
    // biome-ignore lint/suspicious/noExplicitAny: test verify
    let orgALeads: any[] = [];
    // biome-ignore lint/suspicious/noExplicitAny: test verify
    let orgAAccounts: any[] = [];
    // biome-ignore lint/suspicious/noExplicitAny: test verify
    let orgAContacts: any[] = [];
    // biome-ignore lint/suspicious/noExplicitAny: test verify
    let orgAOpps: any[] = [];

    await withTenant(
      orgA,
      process.env.DB_DRIVER === "pg" ? pgDb : mockDb,
      async () => {
        orgALeads = await dbStore.leads.findMany();
        orgAAccounts = await dbStore.accounts.findMany();
        orgAContacts = await dbStore.contacts.findMany();
        orgAOpps = await dbStore.opportunities.findMany();
      },
    );

    expect(orgALeads.length).toBe(1);
    expect(orgAAccounts.length).toBe(1);
    expect(orgAContacts.length).toBe(1);
    expect(orgAOpps.length).toBe(1);

    expect(orgAAccounts[0].id).toBe(convertBody.accountId);
    expect(orgAAccounts[0].name).toBe("Acme Enterprise");

    expect(orgAContacts[0].id).toBe(convertBody.contactId);
    expect(orgAContacts[0].firstName).toBe("bob");
    expect(orgAContacts[0].lastName).toBe("smith");
    expect(orgAContacts[0].email).toBe("bob.smith@acme.com");

    expect(orgAOpps[0].id).toBe(convertBody.opportunityId);
    expect(orgAOpps[0].name).toBe("Acme Big Deal");
    expect(orgAOpps[0].amount).toBe("120000");
    expect(orgAOpps[0].stage).toBe("Qualification");

    // 5. Verify Audit Logs were registered
    // biome-ignore lint/suspicious/noExplicitAny: test verify
    let orgAAudits: any[] = [];
    await withTenant(
      orgA,
      process.env.DB_DRIVER === "pg" ? pgDb : mockDb,
      async () => {
        orgAAudits = await dbStore.auditLogs.findMany();
      },
    );
    // 1 audit for creation, 1 audit for conversion update
    expect(orgAAudits.length).toBe(2);
    expect(orgAAudits[0].action).toBe("create");
    expect(orgAAudits[1].action).toBe("update");
    expect(orgAAudits[1].changes).toEqual({
      status: { before: "New", after: "Converted" },
    });
  });
});
