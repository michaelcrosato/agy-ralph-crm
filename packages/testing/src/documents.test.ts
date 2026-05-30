import { createSessionToken } from "@crm/auth";
import { dbStore, mockDb, withTenant } from "@crm/db";
import { compileTemplate } from "@crm/documents";
import { beforeEach, describe, expect, it } from "vitest";
import { createTestApp } from "./_harness";

const app = createTestApp();

describe("Document Templates & Mail Merge - Core Unit Tests", () => {
  it("should correctly compile text templates containing standard standard paths", () => {
    const template =
      "Hello {{firstName}} {{lastName}}, welcome to the platform!";
    const context = { firstName: "John", lastName: "Doe" };

    const result = compileTemplate(template, context);
    expect(result).toBe("Hello John Doe, welcome to the platform!");
  });

  it("should correctly compile nested object properties and custom JSONB fields", () => {
    const template =
      "Partner Account: {{Account.name}}\nIndustry: {{Account.industry}}\nCustom ID: {{Account.customId}}";
    const context = {
      Account: {
        name: "Stark Industries",
        industry: "Defense",
        custom: {
          customId: "STARK-99",
        },
      },
    };

    const result = compileTemplate(template, context);
    expect(result).toBe(
      "Partner Account: Stark Industries\nIndustry: Defense\nCustom ID: STARK-99",
    );
  });

  it("should format dates cleanly and substitute missing tags with standard placeholders", () => {
    const template =
      "Agreement Date: {{signDate}}\nStatus: {{status}}\nDetails: {{details}}";
    const context = {
      signDate: new Date("2026-05-28T12:00:00Z"),
      status: null,
      // details is missing completely
    };

    const result = compileTemplate(template, context);
    expect(result).toBe(
      "Agreement Date: 2026-05-28\nStatus: [N/A]\nDetails: [N/A]",
    );
  });
});

describe("Document Templates & Mail Merge - Integration REST API Tests", () => {
  let tokenA: string;
  let tokenB: string;

  const orgA = "org-tenant-a";
  const orgB = "org-tenant-b";

  beforeEach(async () => {
    dbStore.clear();

    tokenA = await createSessionToken({
      userId: "user-a",
      orgId: orgA,
      roleId: "role-a",
      permissionsMask: 7,
    });

    tokenB = await createSessionToken({
      userId: "user-b",
      orgId: orgB,
      roleId: "role-b",
      permissionsMask: 7,
    });
  });

  it("should allow managing document templates and executing mail merges per tenant with RLS", async () => {
    // 1. POST /api/documents/templates for Tenant A
    const templateResA = await app.request("/api/documents/templates", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "Welcome Letter",
        content: "Hello {{firstName}} {{lastName}}! Thank you for registering.",
      }),
    });
    expect(templateResA.status).toBe(200);
    const templateDataA = await templateResA.json();
    expect(templateDataA.success).toBe(true);
    const templateIdA = templateDataA.data.id;

    // 2. GET /api/documents/templates for Tenant B -> returns 0 templates (isolated!)
    const getTemplatesB = await app.request("/api/documents/templates", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${tokenB}`,
      },
    });
    expect(getTemplatesB.status).toBe(200);
    const templatesB = await getTemplatesB.json();
    expect(templatesB.data.length).toBe(0);

    // 3. Set up a lead record in Tenant A boundary
    let leadIdA = "";
    await withTenant(orgA, mockDb, async () => {
      const lead = await dbStore.leads.insert({
        orgId: orgA,
        ownerId: "user-a",
        status: "New",
        email: "peter.parker@dailybugle.com",
        company: "Daily Bugle",
        convertedAccountId: null,
        convertedContactId: null,
        custom: null,
      });
      leadIdA = lead.id;
    });

    // 4. POST /api/documents/merge for Tenant A merging Tenant A's lead -> returns compiled output
    const mergeResA = await app.request("/api/documents/merge", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        templateId: templateIdA,
        recordType: "Lead",
        recordId: leadIdA,
      }),
    });
    expect(mergeResA.status).toBe(200);
    const mergeDataA = await mergeResA.json();
    expect(mergeDataA.success).toBe(true);
    expect(mergeDataA.data.compiledContent).toBe(
      "Hello peter parker! Thank you for registering.",
    );

    // 5. POST /api/documents/merge for Tenant B attempting to merge Tenant A's lead -> 404 (isolated RLS)
    const mergeResB = await app.request("/api/documents/merge", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenB}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        templateId: templateIdA, // Note: templateIdA is also Tenant A's template, so B won't even find the template!
        recordType: "Lead",
        recordId: leadIdA,
      }),
    });
    expect(mergeResB.status).toBe(404);
  });
});
