import { createSessionToken } from "@crm/auth";
import { dbStore, mockDb, withTenant } from "@crm/db";
import { beforeEach, describe, expect, it } from "vitest";
import { createTestApp } from "./_harness";

const app = createTestApp();

describe("Analytical Reporting & Saved Views REST API Tests", () => {
  let tokenTenantA: string;
  let tokenTenantB: string;

  const orgA = "org-tenant-a";
  const orgB = "org-tenant-b";

  beforeEach(async () => {
    dbStore.clear();

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
  });

  it("should successfully manage reports and run aggregates isolated by tenant RLS", async () => {
    // 1. Seed CRM records for Tenant A
    await withTenant(orgA, mockDb, async () => {
      // Seed Accounts
      const acc1 = await dbStore.accounts.insert({
        orgId: orgA,
        ownerId: "user-a",
        name: "Acme Corp",
        domain: "acme.com",
        custom: null,
      });

      // Seed Opportunities
      await dbStore.opportunities.insert({
        orgId: orgA,
        ownerId: "user-a",
        accountId: acc1.id,
        name: "Acme Enterprise Deal",
        stage: "Qualification",
        amount: "30000",
        closeDate: null,
        custom: null,
      });

      await dbStore.opportunities.insert({
        orgId: orgA,
        ownerId: "user-a",
        accountId: acc1.id,
        name: "Acme Expansion Deal",
        stage: "Qualification",
        amount: "20000",
        closeDate: null,
        custom: null,
      });

      await dbStore.opportunities.insert({
        orgId: orgA,
        ownerId: "user-a",
        accountId: acc1.id,
        name: "Acme Starter Deal",
        stage: "Prospecting",
        amount: "5000",
        closeDate: null,
        custom: null,
      });

      // Seed Leads with custom JSONB fields (industry)
      await dbStore.leads.insert({
        orgId: orgA,
        ownerId: "user-a",
        status: "New",
        email: "lead1@test.com",
        company: "Alpha Inc",
        convertedAccountId: null,
        convertedContactId: null,
        custom: { industry: "Software" },
      });

      await dbStore.leads.insert({
        orgId: orgA,
        ownerId: "user-a",
        status: "New",
        email: "lead2@test.com",
        company: "Beta Inc",
        convertedAccountId: null,
        convertedContactId: null,
        custom: { industry: "Healthcare" },
      });

      await dbStore.leads.insert({
        orgId: orgA,
        ownerId: "user-a",
        status: "Contacted",
        email: "lead3@test.com",
        company: "Gamma Corp",
        convertedAccountId: null,
        convertedContactId: null,
        custom: { industry: "Software" },
      });

      // Seed Contacts for Ticket links
      const contact1 = await dbStore.contacts.insert({
        orgId: orgA,
        ownerId: "user-a",
        accountId: acc1.id,
        firstName: "John",
        lastName: "Doe",
        email: "john@acme.com",
        custom: null,
      });

      // Seed Tickets
      await dbStore.tickets.insert({
        orgId: orgA,
        contactId: contact1.id,
        subject: "Login Failure",
        status: "Open",
      });

      await dbStore.tickets.insert({
        orgId: orgA,
        contactId: contact1.id,
        subject: "Billing Dispute",
        status: "Open",
      });

      await dbStore.tickets.insert({
        orgId: orgA,
        contactId: contact1.id,
        subject: "Feature Request",
        status: "Resolved",
      });
    });

    // 2. Save report definition for Tenant A (Opportunities grouped by stage summing amount)
    const createRes = await app.request("/api/reports", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenTenantA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "Pipeline by Stage",
        objectType: "opportunities",
        groupBy: "stage",
        aggregateField: "amount",
        aggregateFunc: "sum",
      }),
    });

    expect(createRes.status).toBe(200);
    const createBody = await createRes.json();
    expect(createBody.success).toBe(true);
    expect(createBody.data.id).toBeDefined();
    expect(createBody.data.name).toBe("Pipeline by Stage");

    const reportId = createBody.data.id;

    // 3. List saved reports for Tenant A
    const listResA = await app.request("/api/reports", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${tokenTenantA}`,
      },
    });
    expect(listResA.status).toBe(200);
    const listBodyA = await listResA.json();
    expect(listBodyA.success).toBe(true);
    expect(listBodyA.data.length).toBe(1);
    expect(listBodyA.data[0].id).toBe(reportId);

    // 4. Tenant B lists reports -> gets empty list (RLS)
    const listResB = await app.request("/api/reports", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${tokenTenantB}`,
      },
    });
    expect(listResB.status).toBe(200);
    const listBodyB = await listResB.json();
    expect(listBodyB.success).toBe(true);
    expect(listBodyB.data.length).toBe(0);

    // 5. Execute Saved Report for Tenant A -> returns correct groups and sums
    const runSavedResA = await app.request(`/api/reports/${reportId}/run`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${tokenTenantA}`,
      },
    });
    expect(runSavedResA.status).toBe(200);
    const runSavedBodyA = await runSavedResA.json();
    expect(runSavedBodyA.success).toBe(true);
    expect(runSavedBodyA.data.reportName).toBe("Pipeline by Stage");
    expect(runSavedBodyA.data.data.length).toBe(2);
    // Prospecting should sum to 5000
    expect(runSavedBodyA.data.data[0].group).toBe("Prospecting");
    expect(runSavedBodyA.data.data[0].value).toBe(5000);
    // Qualification should sum to 30000 + 20000 = 50000
    expect(runSavedBodyA.data.data[1].group).toBe("Qualification");
    expect(runSavedBodyA.data.data[1].value).toBe(50000);

    // 6. Tenant B runs Tenant A's saved report -> returns 404 (isolated)
    const runSavedResB = await app.request(`/api/reports/${reportId}/run`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${tokenTenantB}`,
      },
    });
    expect(runSavedResB.status).toBe(404);

    // 7. Run Ad-hoc Report grouping Leads by Status Count for Tenant A
    const adhocLeadsRes = await app.request("/api/reports/run", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenTenantA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        objectType: "leads",
        groupBy: "status",
        aggregateFunc: "count",
      }),
    });
    expect(adhocLeadsRes.status).toBe(200);
    const adhocLeadsBody = await adhocLeadsRes.json();
    expect(adhocLeadsBody.success).toBe(true);
    expect(adhocLeadsBody.data.data.length).toBe(2);
    // Status 'Contacted': 1
    expect(adhocLeadsBody.data.data[0].group).toBe("Contacted");
    expect(adhocLeadsBody.data.data[0].value).toBe(1);
    // Status 'New': 2
    expect(adhocLeadsBody.data.data[1].group).toBe("New");
    expect(adhocLeadsBody.data.data[1].value).toBe(2);

    // 8. Run Ad-hoc Report grouping Leads by custom JSONB industry field for Tenant A
    const adhocCustomRes = await app.request("/api/reports/run", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenTenantA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        objectType: "leads",
        groupBy: "industry",
        aggregateFunc: "count",
      }),
    });
    expect(adhocCustomRes.status).toBe(200);
    const adhocCustomBody = await adhocCustomRes.json();
    expect(adhocCustomBody.success).toBe(true);
    expect(adhocCustomBody.data.data.length).toBe(2);
    // Industry 'Healthcare': 1
    expect(adhocCustomBody.data.data[0].group).toBe("Healthcare");
    expect(adhocCustomBody.data.data[0].value).toBe(1);
    // Industry 'Software': 2
    expect(adhocCustomBody.data.data[1].group).toBe("Software");
    expect(adhocCustomBody.data.data[1].value).toBe(2);

    // 9. Run Ad-hoc Report grouping Tickets by Status for Tenant A
    const adhocTicketsRes = await app.request("/api/reports/run", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenTenantA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        objectType: "tickets",
        groupBy: "status",
        aggregateFunc: "count",
      }),
    });
    expect(adhocTicketsRes.status).toBe(200);
    const adhocTicketsBody = await adhocTicketsRes.json();
    expect(adhocTicketsBody.success).toBe(true);
    expect(adhocTicketsBody.data.data.length).toBe(2);
    // 'Open': 2
    expect(adhocTicketsBody.data.data[0].group).toBe("Open");
    expect(adhocTicketsBody.data.data[0].value).toBe(2);
    // 'Resolved': 1
    expect(adhocTicketsBody.data.data[1].group).toBe("Resolved");
    expect(adhocTicketsBody.data.data[1].value).toBe(1);

    // 10. Tenant B runs ad-hoc Opportunities report -> gets empty list (RLS hides Tenant A records)
    const adhocResB = await app.request("/api/reports/run", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenTenantB}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        objectType: "opportunities",
        groupBy: "stage",
        aggregateFunc: "count",
      }),
    });
    expect(adhocResB.status).toBe(200);
    const adhocBodyB = await adhocResB.json();
    expect(adhocBodyB.success).toBe(true);
    expect(adhocBodyB.data.data.length).toBe(0);
  });
});
