import { createSessionToken } from "@crm/auth";
import { personalizeEmailTemplate } from "@crm/core";
import { dbStore, mockDb, withTenant } from "@crm/db";
import { beforeEach, describe, expect, it } from "vitest";
import { createTestApp } from "./_harness";

const app = createTestApp();

describe("Marketing Sequence Global Merge Variables Tests (Task 0211)", () => {
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

  describe("REST API CRUD & RLS Isolation Tests", () => {
    it("should support creating, listing, and deleting global variables under active tenant isolation", async () => {
      // 1. Create global variable as Tenant A
      const createResA = await app.request(
        "/api/sequences/settings/variables",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${tokenTenantA}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            key: "companyPhone",
            value: "1-800-555-0199",
          }),
        },
      );

      expect(createResA.status).toBe(201);
      const dataA = await createResA.json();
      expect(dataA.success).toBe(true);
      expect(dataA.data.id).toBeDefined();
      expect(dataA.data.key).toBe("companyPhone");
      expect(dataA.data.value).toBe("1-800-555-0199");
      expect(dataA.data.orgId).toBe(orgA);

      const varId = dataA.data.id;

      // 2. List global variables as Tenant A -> returns 1 item
      const listResA = await app.request("/api/sequences/settings/variables", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${tokenTenantA}`,
        },
      });

      expect(listResA.status).toBe(200);
      const listA = await listResA.json();
      expect(listA.success).toBe(true);
      expect(listA.data.length).toBe(1);
      expect(listA.data[0].id).toBe(varId);

      // 3. List global variables as Tenant B -> returns 0 items (strict RLS isolation)
      const listResB = await app.request("/api/sequences/settings/variables", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${tokenTenantB}`,
        },
      });

      expect(listResB.status).toBe(200);
      const listB = await listResB.json();
      expect(listB.success).toBe(true);
      expect(listB.data.length).toBe(0);

      // 4. Tenant B trying to delete Tenant A's variable must fail (404 / RLS block)
      const deleteLeakRes = await app.request(
        `/api/sequences/settings/variables/${varId}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${tokenTenantB}`,
          },
        },
      );

      expect(deleteLeakRes.status).toBe(404);

      // 5. Delete global variable as Tenant A -> success
      const deleteResA = await app.request(
        `/api/sequences/settings/variables/${varId}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${tokenTenantA}`,
          },
        },
      );

      expect(deleteResA.status).toBe(200);
      const deleteDataA = await deleteResA.json();
      expect(deleteDataA.success).toBe(true);

      // 6. List global variables as Tenant A again -> returns 0
      const listResA2 = await app.request("/api/sequences/settings/variables", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${tokenTenantA}`,
        },
      });
      const listA2 = await listResA2.json();
      expect(listA2.data.length).toBe(0);
    });

    it("should reject invalid variable keys or values", async () => {
      const badKeys = ["company-phone", "company phone", "company.phone", ""];
      for (const k of badKeys) {
        const res = await app.request("/api/sequences/settings/variables", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${tokenTenantA}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            key: k,
            value: "value",
          }),
        });
        expect(res.status).toBe(400);
      }
    });
  });

  describe("Personalization & Variable Resolving Tests", () => {
    it("should personalize templates with global variables, defaults, and filter transformations", () => {
      const globalVariables = {
        companyName: "Acme Corp",
        companyPhone: "1-800-555-0100",
      };

      const context = {
        lead: {
          firstName: "Alice",
        },
        globalVariables,
      };

      // 1. Basic path resolving
      let template = {
        subject: "Hello {{lead.firstName}} from {{global.companyName}}",
        body: "Call us at {{global.companyPhone}}",
      };
      let result = personalizeEmailTemplate(template, context);
      expect(result.subject).toBe("Hello Alice from Acme Corp");
      expect(result.body).toBe("Call us at 1-800-555-0100");

      // 2. Global variable with default fallback
      template = {
        subject: "Welcome to {{global.companyName}}",
        body: "Reach us on {{global.supportLine | default('1-800-DEFAULT')}}",
      };
      result = personalizeEmailTemplate(template, context);
      expect(result.subject).toBe("Welcome to Acme Corp");
      expect(result.body).toBe("Reach us on 1-800-DEFAULT");

      // 3. Global variable with casing transformation filter
      template = {
        subject: "ALERT FROM {{global.companyName | uppercase}}",
        body: "Contact {{global.companyName | lowercase}} today",
      };
      result = personalizeEmailTemplate(template, context);
      expect(result.subject).toBe("ALERT FROM ACME CORP");
      expect(result.body).toBe("Contact acme corp today");

      // 4. Safely handle missing variables
      template = {
        subject: "Subject {{global.missingKey}}",
        body: "Body",
      };
      result = personalizeEmailTemplate(template, context);
      expect(result.subject).toBe("Subject ");
    });
  });

  describe("Preview End-to-End API with Global Variables Integration", () => {
    it("should resolve global variables dynamically inside POST /api/sequences/preview", async () => {
      let leadId = "";

      // Create a Lead under Tenant A
      await withTenant(orgA, mockDb, async () => {
        const lead = await dbStore.leads.insert({
          orgId: orgA,
          ownerId: "user-a",
          status: "New",
          email: "alice@example.com",
          company: "Beta LLC",
          convertedAccountId: null,
          convertedContactId: null,
          custom: {
            firstName: "Alice",
          },
        });
        leadId = lead.id;

        // Insert global variables for orgA
        await dbStore.marketingSequenceGlobalVariables.insert({
          orgId: orgA,
          key: "companyName",
          value: "Tenant A Enterprises",
        });
      });

      // Preview Lead template resolving global variables
      const previewRes = await app.request("/api/sequences/preview", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenTenantA}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          subject: "Hello {{lead.custom.firstName}} - {{global.companyName}}",
          body: "Welcome to {{global.companyName | uppercase}}",
          recordType: "lead",
          recordId: leadId,
        }),
      });

      expect(previewRes.status).toBe(200);
      const data = await previewRes.json();
      expect(data.success).toBe(true);
      expect(data.data.subject).toBe("Hello Alice - Tenant A Enterprises");
      expect(data.data.body).toBe("Welcome to TENANT A ENTERPRISES");
    });
  });
});
