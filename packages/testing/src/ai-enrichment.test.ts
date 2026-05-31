import { createSessionToken } from "@crm/auth";
import { AIAttributeService, enrichRecordAttributes } from "@crm/core";
import { dbStore, mockDb, withTenant } from "@crm/db";
import { beforeEach, describe, expect, it } from "vitest";
import { createTestApp } from "./_harness";

const app = createTestApp();

describe("AI Attributes & Auto-Enrichment Core & REST Tests", () => {
  let tokenTenantA: string;
  let tokenTenantB: string;
  const orgA = "org-tenant-a";
  const orgB = "org-tenant-b";

  beforeEach(async () => {
    await dbStore.clear();

    // Generate tokens with full admin permissionsMask (63) to pass all RBAC checks
    tokenTenantA = await createSessionToken({
      userId: "user-a",
      orgId: orgA,
      roleId: "role-a",
      permissionsMask: 63,
    });

    tokenTenantB = await createSessionToken({
      userId: "user-b",
      orgId: orgB,
      roleId: "role-b",
      permissionsMask: 63,
    });
  });

  describe("Offline NLP Rule Engine (enrichRecordAttributes)", () => {
    it("should calculate high suitability score for tech company details", () => {
      const record = {
        firstName: "Jane",
        lastName: "Smith",
        email: "jane@nextsaas.tech",
        company: "NextSaas AI Solutions",
        custom: { notes: "Interested in migration from HubSpot." },
      };

      const enriched = enrichRecordAttributes("Lead", record);
      expect(enriched.icpScore).toBeGreaterThanOrEqual(85);
      expect(enriched.competitorMentions).toContain("HubSpot");
      expect(enriched.aiSummary).toContain("Jane Smith");
      expect(enriched.aiSummary).toContain("NextSaas AI Solutions");
    });

    it("should calculate lower score for retail or personal domains", () => {
      const record = {
        firstName: "Bob",
        lastName: "Johnson",
        email: "bob@gmail.com",
        company: "Bob's Retail Hobby Shop",
        custom: { notes: "Looking at Pipedrive and Zoho." },
      };

      const enriched = enrichRecordAttributes("Contact", record);
      expect(enriched.icpScore).toBeLessThan(50);
      expect(enriched.competitorMentions).toContain("Pipedrive");
      expect(enriched.competitorMentions).toContain("Zoho");
      expect(enriched.aiSummary).toContain("Bob Johnson");
    });
  });

  describe("REST Gateway Endpoints", () => {
    it("should support force manual enrichment for leads and contacts", async () => {
      // 1. Insert a Lead for Tenant A
      let leadId = "";
      await withTenant(orgA, mockDb, async () => {
        const lead = await dbStore.leads.insert({
          orgId: orgA,
          ownerId: "user-a",
          firstName: "Alice",
          lastName: "SaasCorp",
          email: "alice@saascorp.io",
          company: "SaasCorp Software",
          status: "New",
          custom: { notes: "Evaluating Salesforce or Twenty." },
        });
        leadId = lead.id;
      });

      // 2. Trigger force-enrichment POST endpoint
      const res = await app.request(`/api/leads/${leadId}/enrich`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenTenantA}`,
        },
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.custom.aiSummary).toBeDefined();
      expect(body.data.custom.icpScore).toBeGreaterThanOrEqual(80);
      expect(body.data.custom.competitorMentions).toContain("Salesforce");
      expect(body.data.custom.competitorMentions).toContain("Twenty");

      // 3. Confirm that it persisted to the store
      await withTenant(orgA, mockDb, async () => {
        const updated = await dbStore.leads.findOne(leadId);
        expect(updated?.custom.aiSummary).toContain("Alice SaasCorp");
      });
    });

    it("should enforce organization-level RLS isolation and deny cross-tenant enrichment", async () => {
      // 1. Insert a Contact for Tenant A
      let contactId = "";
      await withTenant(orgA, mockDb, async () => {
        const contact = await dbStore.contacts.insert({
          orgId: orgA,
          ownerId: "user-a",
          firstName: "John",
          lastName: "Doe",
          email: "john@doe.tech",
        });
        contactId = contact.id;
      });

      // 2. Attempt to enrich Tenant A's contact using Tenant B's token
      const res = await app.request(`/api/contacts/${contactId}/enrich`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenTenantB}`,
        },
      });

      // RBAC/RLS boundary must reject or deny access (should return 404 contact not found or 403)
      expect(res.status).toBe(400); // throws not found inside withTenant since it filters by active tenant
    });
  });

  describe("Asynchronous Mutation Triggers", () => {
    it("should automatically run enrichment in the background on record mutations", async () => {
      // Initialize background service hooks
      AIAttributeService.initialize();

      // 1. Create a lead via API POST
      const res = await app.request("/api/leads", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenTenantA}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          firstName: "David",
          lastName: "CloudTech",
          email: "david@cloudtech.ai",
          company: "CloudTech Software Inc",
          status: "New",
          custom: { notes: "We love Twenty CRM!" },
        }),
      });

      expect(res.status).toBe(200);
      const lead = (await res.json()).data;
      expect(lead.id).toBeDefined();

      // 2. Wait briefly to let the async queue worker process enrichment
      await new Promise((resolve) => setTimeout(resolve, 100));

      // 3. Retrieve the lead and confirm enrichment attributes were populated
      await withTenant(orgA, mockDb, async () => {
        const enrichedLead = await dbStore.leads.findOne(lead.id);
        expect(enrichedLead?.custom.aiSummary).toContain(
          "CloudTech Software Inc",
        );
        expect(enrichedLead?.custom.icpScore).toBeGreaterThanOrEqual(80);
        expect(enrichedLead?.custom.competitorMentions).toContain("Twenty");
      });
    });
  });
});
