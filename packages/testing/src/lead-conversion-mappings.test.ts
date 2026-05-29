import { createSessionToken } from "@crm/auth";
import { convertLeadWithMappings } from "@crm/core";
import { dbStore, mockDb, store, withTenant } from "@crm/db";
import { beforeEach, describe, expect, it } from "vitest";
import app from "../../../apps/api/src/index";

describe("Lead Conversion Field Mapping Engine API & Logic Tests", () => {
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

  describe("Core Business Logic", () => {
    it("should accurately resolve dynamic lead mappings", () => {
      const lead = {
        id: "lead-test",
        orgId: orgA,
        ownerId: "user-a",
        status: "New",
        email: "patient@hospital.com",
        company: "General Hospital",
        custom: {
          industry: "Healthcare",
          budget: 50000,
        },
      };

      const mappings = [
        {
          sourceLeadField: "custom.industry",
          targetObjectType: "accounts" as const,
          targetField: "custom.industry_segment",
        },
        {
          sourceLeadField: "custom.budget",
          targetObjectType: "opportunities" as const,
          targetField: "custom.deal_budget",
        },
        {
          sourceLeadField: "email",
          targetObjectType: "contacts" as const,
          targetField: "custom.original_lead_email",
        },
      ];

      const entities = convertLeadWithMappings({
        lead,
        opportunityName: "Big Deal",
        opportunityAmount: "100000.00",
        mappings,
      });

      expect(entities.account.name).toBe("General Hospital");
      expect(entities.account.custom).toBeDefined();
      expect(entities.account.custom?.industry).toBe("Healthcare");
      expect(entities.account.custom?.industry_segment).toBe("Healthcare");

      expect(entities.contact.email).toBe("patient@hospital.com");
      expect(entities.contact.custom).toBeDefined();
      expect(entities.contact.custom?.original_lead_email).toBe(
        "patient@hospital.com",
      );

      expect(entities.opportunity).toBeDefined();
      expect(entities.opportunity?.name).toBe("Big Deal");
      expect(entities.opportunity?.amount).toBe("100000.00");
      expect(entities.opportunity?.custom).toBeDefined();
      expect(entities.opportunity?.custom?.deal_budget).toBe(50000);
    });
  });

  describe("REST API Endpoints", () => {
    it("should perform CRUD on mappings and enforce strict tenant RLS isolation", async () => {
      // 1. Create a mapping as Tenant A
      const postRes = await app.request("/api/lead-conversions/mappings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${tokenTenantA}`,
        },
        body: JSON.stringify({
          sourceLeadField: "custom.industry",
          targetObjectType: "accounts",
          targetField: "custom.industry_segment",
        }),
      });

      expect(postRes.status).toBe(201);
      const postBody = await postRes.json();
      expect(postBody.success).toBe(true);
      expect(postBody.data.id).toBeDefined();
      expect(postBody.data.sourceLeadField).toBe("custom.industry");

      const mappingId = postBody.data.id;

      // 2. RLS - Tenant B attempts to read Tenant A's mappings -> should receive empty or own mappings
      const getBRes = await app.request("/api/lead-conversions/mappings", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${tokenTenantB}`,
        },
      });
      expect(getBRes.status).toBe(200);
      const getBBody = await getBRes.json();
      expect(getBBody.data.length).toBe(0);

      // 3. GET - Tenant A retrieves its mappings
      const getARes = await app.request("/api/lead-conversions/mappings", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${tokenTenantA}`,
        },
      });
      expect(getARes.status).toBe(200);
      const getABody = await getARes.json();
      expect(getABody.data.length).toBe(1);
      expect(getABody.data[0].id).toBe(mappingId);

      // 4. RLS - Tenant B attempts to delete Tenant A's mapping -> should fail with 404
      const delBRes = await app.request(
        `/api/lead-conversions/mappings/${mappingId}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${tokenTenantB}`,
          },
        },
      );
      expect(delBRes.status).toBe(404);

      // 5. DELETE - Tenant A deletes mapping
      const delARes = await app.request(
        `/api/lead-conversions/mappings/${mappingId}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${tokenTenantA}`,
          },
        },
      );
      expect(delARes.status).toBe(200);

      // 6. Verify deletion
      const getFinalRes = await app.request("/api/lead-conversions/mappings", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${tokenTenantA}`,
        },
      });
      const getFinalBody = await getFinalRes.json();
      expect(getFinalBody.data.length).toBe(0);
    });

    it("should dynamically apply active mappings during lead conversion", async () => {
      // 1. Setup Lead for Tenant A
      let leadId = "";
      await withTenant(orgA, mockDb, async () => {
        const lead = await dbStore.leads.insert({
          orgId: orgA,
          ownerId: "user-a",
          status: "New",
          email: "lead@example.com",
          company: "ACME Corp",
          convertedAccountId: null,
          convertedContactId: null,
          custom: {
            industry: "Technology",
            referralSource: "Google",
          },
        });
        leadId = lead.id;
      });

      // 2. Setup Conversion Mapping for Tenant A
      await app.request("/api/lead-conversions/mappings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${tokenTenantA}`,
        },
        body: JSON.stringify({
          sourceLeadField: "custom.industry",
          targetObjectType: "accounts",
          targetField: "custom.vertical_segment",
        }),
      });

      await app.request("/api/lead-conversions/mappings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${tokenTenantA}`,
        },
        body: JSON.stringify({
          sourceLeadField: "custom.referralSource",
          targetObjectType: "opportunities",
          targetField: "custom.campaign_source",
        }),
      });

      // 3. Convert the Lead
      const convertRes = await app.request(`/api/leads/${leadId}/convert`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${tokenTenantA}`,
        },
        body: JSON.stringify({
          opportunityName: "Enterprise ACME Deal",
          opportunityAmount: "85000.00",
        }),
      });

      expect(convertRes.status).toBe(200);
      const convertBody = await convertRes.json();
      expect(convertBody.success).toBe(true);
      expect(convertBody.accountId).toBeDefined();
      expect(convertBody.contactId).toBeDefined();
      expect(convertBody.opportunityId).toBeDefined();

      const accId = convertBody.accountId;
      const oppId = convertBody.opportunityId;

      // 4. Verify Account fields
      const accRes = await app.request("/api/accounts", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${tokenTenantA}`,
        },
      });
      const accBody = await accRes.json();
      // biome-ignore lint/suspicious/noExplicitAny: test verification
      const account = accBody.data.find((a: any) => a.id === accId);
      expect(account).toBeDefined();
      expect(account.custom).toBeDefined();
      expect(account.custom.vertical_segment).toBe("Technology");

      // 5. Verify Opportunity fields
      const oppRes = await app.request(`/api/opportunities/${oppId}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${tokenTenantA}`,
        },
      });
      const oppBody = await oppRes.json();
      const opportunity = oppBody.data;
      expect(opportunity).toBeDefined();
      expect(opportunity.custom).toBeDefined();
      expect(opportunity.custom.campaign_source).toBe("Google");
    });
  });
});
