import { createSessionToken } from "@crm/auth";
import { dbStore, mockDb, store, withTenant } from "@crm/db";
import { beforeEach, describe, expect, it } from "vitest";
import app from "../../../apps/api/src/index";

describe("Email HTML Templates & Merge Fields API & Integration Tests", () => {
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

  it("should support CRUD on email templates under strict tenant context", async () => {
    // 1. Create email template for Tenant A
    const resCreate = await app.request("/api/metadata/email-templates", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenTenantA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "Welcome Template",
        subject: "Welcome, {{Contact.firstName}}!",
        body: "<p>Hi {{Contact.firstName}}, welcome to {{Account.name}}.</p>",
      }),
    });
    expect(resCreate.status).toBe(200);
    const bodyCreate = await resCreate.json();
    expect(bodyCreate.success).toBe(true);
    expect(bodyCreate.data.name).toBe("Welcome Template");
    expect(bodyCreate.data.orgId).toBe(orgA);
    const templateId = bodyCreate.data.id;

    // 2. Fetch email templates for Tenant A
    const resList = await app.request("/api/metadata/email-templates", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${tokenTenantA}`,
      },
    });
    expect(resList.status).toBe(200);
    const bodyList = await resList.json();
    expect(bodyList.data).toHaveLength(1);
    expect(bodyList.data[0].name).toBe("Welcome Template");

    // 3. Verify Tenant B sees 0 templates
    const resListB = await app.request("/api/metadata/email-templates", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${tokenTenantB}`,
      },
    });
    expect(resListB.status).toBe(200);
    const bodyListB = await resListB.json();
    expect(bodyListB.data).toHaveLength(0);

    // 4. Delete the email template
    const resDelete = await app.request(
      `/api/metadata/email-templates/${templateId}`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${tokenTenantA}`,
        },
      },
    );
    expect(resDelete.status).toBe(200);

    // 5. Verify it's deleted
    const resListAfter = await app.request("/api/metadata/email-templates", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${tokenTenantA}`,
      },
    });
    const bodyListAfter = await resListAfter.json();
    expect(bodyListAfter.data).toHaveLength(0);
  });

  it("should compile email templates using merge fields from lead, account, contact, and opportunity", async () => {
    let leadId = "";
    let accountId = "";
    let contactId = "";
    let opportunityId = "";
    let templateId = "";

    // Setup mock data under Tenant A
    await withTenant(orgA, mockDb, async () => {
      const lead = await dbStore.leads.insert({
        orgId: orgA,
        ownerId: "user-a",
        status: "New",
        email: "alice@domain.com",
        company: "Alice Corp",
        convertedAccountId: null,
        convertedContactId: null,
        custom: {
          score: 125,
        },
      });
      leadId = lead.id;

      const account = await dbStore.accounts.insert({
        orgId: orgA,
        ownerId: "user-a",
        name: "Acme Enterprises",
        domain: "acme.com",
        custom: null,
      });
      accountId = account.id;

      const contact = await dbStore.contacts.insert({
        orgId: orgA,
        ownerId: "user-a",
        accountId: account.id,
        firstName: "Bob",
        lastName: "Smith",
        email: "bob@acme.com",
        custom: {
          title: "VP of Sales",
        },
      });
      contactId = contact.id;

      const opportunity = await dbStore.opportunities.insert({
        orgId: orgA,
        ownerId: "user-a",
        accountId: account.id,
        name: "Acme Big Deal",
        stage: "Negotiation",
        amount: "50000.00",
        closeDate: new Date(),
        custom: null,
      });
      opportunityId = opportunity.id;

      const template = await dbStore.emailTemplates.insert({
        orgId: orgA,
        name: "Acme Pitch Template",
        subject: "Proposal for {{Account.name}}: {{Opportunity.name}}",
        body: "Hi {{Contact.firstName}} ({{Contact.custom.title}}),\n\nWe are pitching a deal for {{Opportunity.amount}} to {{Account.name}}.\nLead score is {{Lead.custom.score}}.\nMissing field is: {{Lead.unresolvedField}}.",
      });
      templateId = template.id;
    });

    // Run compile API endpoint
    const resCompile = await app.request(
      `/api/metadata/email-templates/${templateId}/compile`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenTenantA}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          leadId,
          accountId,
          contactId,
          opportunityId,
        }),
      },
    );

    expect(resCompile.status).toBe(200);
    const bodyCompile = await resCompile.json();
    expect(bodyCompile.success).toBe(true);

    expect(bodyCompile.compiledSubject).toBe(
      "Proposal for Acme Enterprises: Acme Big Deal",
    );
    expect(bodyCompile.compiledBody).toBe(
      "Hi Bob (VP of Sales),\n\nWe are pitching a deal for 50000.00 to Acme Enterprises.\nLead score is 125.\nMissing field is: .",
    );
  });

  it("should enforce strict tenant isolation and block unauthorized compiles", async () => {
    let templateIdA = "";
    let contactIdB = "";

    // 1. Tenant A template
    await withTenant(orgA, mockDb, async () => {
      const template = await dbStore.emailTemplates.insert({
        orgId: orgA,
        name: "Tenant A Template",
        subject: "Hello {{Contact.firstName}}",
        body: "Tenant A Body",
      });
      templateIdA = template.id;
    });

    // 2. Tenant B contact
    await withTenant(orgB, mockDb, async () => {
      const contact = await dbStore.contacts.insert({
        orgId: orgB,
        ownerId: "user-b",
        firstName: "Secret",
        lastName: "Agent",
        email: "secret@domain.com",
        accountId: null,
        custom: null,
      });
      contactIdB = contact.id;
    });

    // 3. Tenant B trying to compile Tenant A template -> should return 404
    const resCompileUnauthorized = await app.request(
      `/api/metadata/email-templates/${templateIdA}/compile`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenTenantB}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contactId: contactIdB,
        }),
      },
    );
    expect(resCompileUnauthorized.status).toBe(404);

    // 4. Tenant A compiling with Tenant B contact (which belongs to B) -> should compile contact as empty since A can't see B's contact
    const resCompileBLeak = await app.request(
      `/api/metadata/email-templates/${templateIdA}/compile`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenTenantA}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contactId: contactIdB, // Belongs to B
        }),
      },
    );
    expect(resCompileBLeak.status).toBe(200);
    const bodyLeak = await resCompileBLeak.json();
    expect(bodyLeak.success).toBe(true);
    expect(bodyLeak.compiledSubject).toBe("Hello "); // Contact resolved to empty due to tenant separation!
  });
});
