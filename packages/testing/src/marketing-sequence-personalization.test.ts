import { createSessionToken } from "@crm/auth";
import { personalizeEmailTemplate } from "@crm/core";
import { dbStore, mockDb, withTenant } from "@crm/db";
import { beforeEach, describe, expect, it } from "vitest";
import app from "../../../apps/api/src/index";

describe("Marketing Sequence Personalization Engine Tests (Task 0210)", () => {
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

    await withTenant(orgA, mockDb, async () => {
      await dbStore.memberships.insert({
        orgId: orgA,
        userId: "user-a",
        roleId: "role-a",
      });
    });

    await withTenant(orgB, mockDb, async () => {
      await dbStore.memberships.insert({
        orgId: orgB,
        userId: "user-b",
        roleId: "role-b",
      });
    });
  });

  it("should personalize templates with fallbacks, casing transformations, and conditions", () => {
    const context = {
      lead: {
        id: "lead-1",
        firstName: "Michael",
        lastName: null,
        company: "Google DeepMind",
      },
      account: {
        name: "Google Inc",
      },
    };

    // 1. Basic path resolution
    let template = {
      subject: "Hello {{lead.firstName}}",
      body: "Welcome to {{account.name}}",
    };
    let result = personalizeEmailTemplate(template, context);
    expect(result.subject).toBe("Hello Michael");
    expect(result.body).toBe("Welcome to Google Inc");

    // 2. Default fallback filter
    template = {
      subject: "Dear {{lead.lastName | default('Valued Customer')}}",
      body: "Hi {{lead.firstName | default('friend')}}",
    };
    result = personalizeEmailTemplate(template, context);
    expect(result.subject).toBe("Dear Valued Customer");
    expect(result.body).toBe("Hi Michael");

    // 3. Transform filters
    template = {
      subject: "Alert from {{account.name | uppercase}}",
      body: "Email to {{lead.firstName | lowercase}}",
    };
    result = personalizeEmailTemplate(template, context);
    expect(result.subject).toBe("Alert from GOOGLE INC");
    expect(result.body).toBe("Email to michael");

    // 4. Combined chaining
    template = {
      subject: "Welcome {{lead.lastName | default('friend') | uppercase}}",
      body: "Company: {{lead.company | uppercase}}",
    };
    result = personalizeEmailTemplate(template, context);
    expect(result.subject).toBe("Welcome FRIEND");
    expect(result.body).toBe("Company: GOOGLE DEEPMIND");

    // 5. Conditional IF/ELSE
    template = {
      subject:
        "{% if lead.company %}Working at {{lead.company}}{% else %}Self-employed{% endif %}",
      body: "{% if lead.lastName %}Name is {{lead.lastName}}{% else %}No last name listed{% endif %}",
    };
    result = personalizeEmailTemplate(template, context);
    expect(result.subject).toBe("Working at Google DeepMind");
    expect(result.body).toBe("No last name listed");
  });

  it("should expose REST preview endpoint and enforce active tenant RLS isolation boundaries", async () => {
    let leadAId = "";
    let _leadBId = "";

    // Setup Lead for Tenant A
    await withTenant(orgA, mockDb, async () => {
      const lead = await dbStore.leads.insert({
        orgId: orgA,
        ownerId: "user-a",
        status: "New",
        email: "lead_a@example.com",
        company: "Acme Corp",
        convertedAccountId: null,
        convertedContactId: null,
        custom: {
          firstName: "Alice",
        },
      });
      leadAId = lead.id;
    });

    // Setup Lead for Tenant B
    await withTenant(orgB, mockDb, async () => {
      const lead = await dbStore.leads.insert({
        orgId: orgB,
        ownerId: "user-b",
        status: "New",
        email: "lead_b@example.com",
        company: "Beta LLC",
        convertedAccountId: null,
        convertedContactId: null,
        custom: {
          firstName: "Bob",
        },
      });
      _leadBId = lead.id;
    });

    // 1. Preview Tenant A's lead using Tenant A's token
    const resA = await app.request("/api/sequences/preview", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenTenantA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        subject:
          "Hello {{lead.custom.firstName}} from {{lead.company | uppercase}}",
        body: "{% if lead.company %}At {{lead.company}}{% else %}No company{% endif %}",
        recordType: "lead",
        recordId: leadAId,
      }),
    });

    expect(resA.status).toBe(200);
    const dataA = await resA.json();
    expect(dataA.success).toBe(true);
    expect(dataA.data.subject).toBe("Hello Alice from ACME CORP");
    expect(dataA.data.body).toBe("At Acme Corp");

    // 2. Tenant B attempting to preview Tenant A's lead must fail (RLS boundary)
    const resLeak = await app.request("/api/sequences/preview", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenTenantB}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        subject: "Hello {{lead.custom.firstName}}",
        body: "Body",
        recordType: "lead",
        recordId: leadAId, // Tenant A's Lead
      }),
    });

    expect(resLeak.status).toBe(404);
    const dataLeak = await resLeak.json();
    expect(dataLeak.success).toBe(false);
    expect(dataLeak.error).toBe("Record not found");
  });
});
