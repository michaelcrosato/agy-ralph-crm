import { createSessionToken } from "@crm/auth";
import { dbStore, mockDb, store, withTenant } from "@crm/db";
import { beforeEach, describe, expect, it } from "vitest";
import app from "../../../apps/api/src/index";

describe("Lead Auto-Conversion Rules & Criteria Engine Tests", () => {
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

  it("should support CRUD on lead auto-conversion rules under strict tenant context", async () => {
    // 1. Create a lead auto-conversion rule for Tenant A
    const resCreate = await app.request("/api/leads/auto-conversion-rules", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenTenantA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "Enterprise Score Conversion",
        isActive: 1,
        createOpportunity: 1,
        opportunityStage: "Qualification",
        criteria: {
          field: "score",
          operator: "greater_or_equal",
          value: 90,
        },
      }),
    });
    expect(resCreate.status).toBe(201);
    const bodyCreate = await resCreate.json();
    expect(bodyCreate.success).toBe(true);
    expect(bodyCreate.data.name).toBe("Enterprise Score Conversion");
    expect(bodyCreate.data.orgId).toBe(orgA);

    // 2. Fetch all rules for Tenant A
    const resList = await app.request("/api/leads/auto-conversion-rules", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${tokenTenantA}`,
      },
    });
    expect(resList.status).toBe(200);
    const bodyList = await resList.json();
    expect(bodyList.data).toHaveLength(1);
    expect(bodyList.data[0].name).toBe("Enterprise Score Conversion");

    // 3. Verify Tenant B sees 0 rules
    const resListB = await app.request("/api/leads/auto-conversion-rules", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${tokenTenantB}`,
      },
    });
    expect(resListB.status).toBe(200);
    const bodyListB = await resListB.json();
    expect(bodyListB.data).toHaveLength(0);
  });

  it("should automatically convert lead when status condition matches on creation", async () => {
    // Setup active auto-conversion rule matching status = "Qualified"
    await withTenant(orgA, mockDb, async () => {
      await dbStore.leadAutoConversionRules.insert({
        orgId: orgA,
        name: "Qualified Status Conversion",
        isActive: 1,
        createOpportunity: 1,
        opportunityStage: "Qualification",
        criteria: {
          field: "status",
          operator: "equals",
          value: "Qualified",
        },
      });
    });

    // Create a Lead with status "Qualified"
    const resCreate = await app.request("/api/leads", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenTenantA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: "elon@tesla.com",
        company: "Tesla Inc",
        status: "Qualified",
      }),
    });

    expect(resCreate.status).toBe(200);
    const bodyCreate = await resCreate.json();
    expect(bodyCreate.success).toBe(true);
    expect(bodyCreate.autoConverted).not.toBeNull();
    expect(bodyCreate.autoConverted.converted).toBe(true);
    expect(bodyCreate.autoConverted.accountId).toBeDefined();
    expect(bodyCreate.autoConverted.contactId).toBeDefined();
    expect(bodyCreate.autoConverted.opportunityId).toBeDefined();

    // Verify persisted entities
    await withTenant(orgA, mockDb, async () => {
      const leads = await dbStore.leads.findMany();
      const accounts = await dbStore.accounts.findMany();
      const contacts = await dbStore.contacts.findMany();
      const opportunities = await dbStore.opportunities.findMany();

      expect(leads[0].status).toBe("Converted");
      expect(leads[0].convertedAccountId).toBe(accounts[0].id);
      expect(leads[0].convertedContactId).toBe(contacts[0].id);

      expect(accounts[0].name).toBe("Tesla Inc");
      expect(contacts[0].email).toBe("elon@tesla.com");
      expect(opportunities[0].accountId).toBe(accounts[0].id);
      expect(opportunities[0].stage).toBe("Qualification");
    });
  });

  it("should automatically convert lead when score condition is met during score recalculation", async () => {
    let leadId = "";

    await withTenant(orgA, mockDb, async () => {
      // 1. Setup auto-conversion rule
      await dbStore.leadAutoConversionRules.insert({
        orgId: orgA,
        name: "High Score Conversion",
        isActive: 1,
        createOpportunity: 0,
        opportunityStage: "Qualification",
        criteria: {
          field: "score",
          operator: "greater_or_equal",
          value: 100,
        },
      });

      // 2. Setup lead scoring rules that will result in 100 score
      await dbStore.leadScoringRules.insert({
        orgId: orgA,
        name: "Tesla Bonus",
        scoreValue: 100,
        isActive: 1,
        criteria: [
          {
            field: "company",
            operator: "equals",
            value: "Tesla",
          },
        ],
      });

      // 3. Create lead
      const lead = await dbStore.leads.insert({
        orgId: orgA,
        ownerId: "user-a",
        status: "New",
        email: "elon@tesla.com",
        company: "Tesla",
        convertedAccountId: null,
        convertedContactId: null,
        custom: {},
      });
      leadId = lead.id;
    });

    // Recalculate score via API
    const resRecalc = await app.request(
      `/api/leads/${leadId}/score/recalculate`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenTenantA}`,
        },
      },
    );

    expect(resRecalc.status).toBe(200);
    const bodyRecalc = await resRecalc.json();
    expect(bodyRecalc.success).toBe(true);
    expect(bodyRecalc.autoConverted).not.toBeNull();
    expect(bodyRecalc.autoConverted.converted).toBe(true);
    expect(bodyRecalc.autoConverted.accountId).toBeDefined();
    expect(bodyRecalc.autoConverted.contactId).toBeDefined();
    expect(bodyRecalc.autoConverted.opportunityId).toBeUndefined(); // createOpportunity is 0

    // Verify converted status
    await withTenant(orgA, mockDb, async () => {
      const lead = await dbStore.leads.findOne(leadId);
      expect(lead?.status).toBe("Converted");
    });
  });

  it("should automatically convert lead when patching lead to meet criteria", async () => {
    let leadId = "";

    await withTenant(orgA, mockDb, async () => {
      // 1. Setup auto-conversion rule for Qualified status
      await dbStore.leadAutoConversionRules.insert({
        orgId: orgA,
        name: "Patch Status Rule",
        isActive: 1,
        createOpportunity: 1,
        opportunityStage: "Prospecting",
        criteria: {
          field: "status",
          operator: "equals",
          value: "Qualified",
        },
      });

      // 2. Create lead with New status
      const lead = await dbStore.leads.insert({
        orgId: orgA,
        ownerId: "user-a",
        status: "New",
        email: "test@gmail.com",
        company: "My Biz",
        convertedAccountId: null,
        convertedContactId: null,
        custom: {},
      });
      leadId = lead.id;
    });

    // 3. Patch lead to status "Qualified"
    const resPatch = await app.request(`/api/leads/${leadId}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${tokenTenantA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        status: "Qualified",
      }),
    });

    expect(resPatch.status).toBe(200);
    const bodyPatch = await resPatch.json();
    expect(bodyPatch.success).toBe(true);
    expect(bodyPatch.autoConverted).not.toBeNull();
    expect(bodyPatch.autoConverted.converted).toBe(true);

    // Verify entities are converted and opportunity is in "Prospecting" stage
    await withTenant(orgA, mockDb, async () => {
      const opps = await dbStore.opportunities.findMany();
      expect(opps[0].stage).toBe("Prospecting");
    });
  });
});
