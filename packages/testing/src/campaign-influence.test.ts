import { createSessionToken } from "@crm/auth";
import { dbStore, mockDb, withTenant } from "@crm/db";
import { beforeEach, describe, expect, it } from "vitest";
import app from "../../../apps/api/src/index";

describe("Campaign Influence API & Integration Tests", () => {
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

  it("should support CRUD for campaign influence and correctly calculate pro-rata revenue shares", async () => {
    let oppId = "";
    let campaignId1 = "";
    let campaignId2 = "";

    // Set up database records for Tenant A
    await withTenant(orgA, mockDb, async () => {
      await dbStore.webhooks.insert({
        orgId: orgA,
        targetUrl: "https://receiver-a.com/webhook",
        secret: "my-signing-secret",
        status: "active",
      });

      const opportunity = await dbStore.opportunities.insert({
        orgId: orgA,
        ownerId: "user-a",
        name: "Enterprise Software Opportunity",
        stage: "Prospecting",
        amount: "50000.00",
        closeDate: null,
        custom: null,
      });
      oppId = opportunity.id;

      const campaign1 = await dbStore.campaigns.insert({
        orgId: orgA,
        name: "Webinar Campaign",
        status: "Active",
        type: "Webinar",
        isActive: 1,
        startDate: null,
        endDate: null,
        budgetedCost: "1000.00",
        actualCost: "800.00",
        expectedRevenue: "10000.00",
        createdAt: new Date(),
      });
      campaignId1 = campaign1.id;

      const campaign2 = await dbStore.campaigns.insert({
        orgId: orgA,
        name: "Direct Mail Campaign",
        status: "Active",
        type: "Direct Mail",
        isActive: 1,
        startDate: null,
        endDate: null,
        budgetedCost: "2000.00",
        actualCost: "1500.00",
        expectedRevenue: "20000.00",
        createdAt: new Date(),
      });
      campaignId2 = campaign2.id;
    });

    // 1. GET: Query campaign influence (should be empty initially)
    const resGetEmpty = await app.request(
      `/api/opportunities/${oppId}/campaign-influence`,
      {
        method: "GET",
        headers: { Authorization: `Bearer ${tokenTenantA}` },
      },
    );
    expect(resGetEmpty.status).toBe(200);
    const bodyGetEmpty = await resGetEmpty.json();
    expect(bodyGetEmpty.success).toBe(true);
    expect(bodyGetEmpty.data).toHaveLength(0);

    // 2. POST: Assign Campaign 1 with 60% influence
    const resPost1 = await app.request(
      `/api/opportunities/${oppId}/campaign-influence`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenTenantA}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          campaignId: campaignId1,
          influencePercentage: 60,
        }),
      },
    );
    expect(resPost1.status).toBe(201);
    const bodyPost1 = await resPost1.json();
    expect(bodyPost1.success).toBe(true);
    expect(bodyPost1.data.influencePercentage).toBe(60);
    // 60% of 50000.00 is 30000.00
    expect(bodyPost1.data.revenueShare).toBe("30000.00");
    const infId1 = bodyPost1.data.id;

    // 3. POST: Attempt to assign Campaign 2 with 50% influence (should fail: total exceeds 100%)
    const resPostFail = await app.request(
      `/api/opportunities/${oppId}/campaign-influence`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenTenantA}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          campaignId: campaignId2,
          influencePercentage: 50,
        }),
      },
    );
    expect(resPostFail.status).toBe(400);
    const bodyPostFail = await resPostFail.json();
    expect(bodyPostFail.error).toContain("exceed 100%");

    // 4. POST: Assign Campaign 2 with 40% influence (should succeed: total = 100%)
    const resPost2 = await app.request(
      `/api/opportunities/${oppId}/campaign-influence`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenTenantA}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          campaignId: campaignId2,
          influencePercentage: 40,
        }),
      },
    );
    expect(resPost2.status).toBe(201);
    const bodyPost2 = await resPost2.json();
    expect(bodyPost2.success).toBe(true);
    expect(bodyPost2.data.influencePercentage).toBe(40);
    // 40% of 50000.00 is 20000.00
    expect(bodyPost2.data.revenueShare).toBe("20000.00");
    const infId2 = bodyPost2.data.id;

    // 5. GET: Query all campaign influence records
    const resGet = await app.request(
      `/api/opportunities/${oppId}/campaign-influence`,
      {
        method: "GET",
        headers: { Authorization: `Bearer ${tokenTenantA}` },
      },
    );
    expect(resGet.status).toBe(200);
    const bodyGet = await resGet.json();
    expect(bodyGet.data).toHaveLength(2);
    expect(
      bodyGet.data.map((i: { campaignId: string }) => i.campaignId),
    ).toContain(campaignId1);
    expect(
      bodyGet.data.map((i: { campaignId: string }) => i.campaignId),
    ).toContain(campaignId2);

    // 6. DELETE: Remove Campaign 1 influence
    const resDelete = await app.request(
      `/api/opportunities/${oppId}/campaign-influence/${infId1}`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${tokenTenantA}` },
      },
    );
    expect(resDelete.status).toBe(200);
    const bodyDelete = await resDelete.json();
    expect(bodyDelete.success).toBe(true);

    // 7. GET: Verify deleted
    const resGetAfterDelete = await app.request(
      `/api/opportunities/${oppId}/campaign-influence`,
      {
        method: "GET",
        headers: { Authorization: `Bearer ${tokenTenantA}` },
      },
    );
    expect(resGetAfterDelete.status).toBe(200);
    const bodyGetAfterDelete = await resGetAfterDelete.json();
    expect(bodyGetAfterDelete.data).toHaveLength(1);
    expect(bodyGetAfterDelete.data[0].id).toBe(infId2);

    // Verify Audit Trail is generated
    await withTenant(orgA, mockDb, async () => {
      const logs = await dbStore.auditLogs.findMany();
      const addLogs = logs.filter((l) => l.action === "add_campaign_influence");
      const removeLogs = logs.filter(
        (l) => l.action === "remove_campaign_influence",
      );
      expect(addLogs).toHaveLength(2);
      expect(removeLogs).toHaveLength(1);
    });

    // Verify Outbound Webhooks are queued and delivered
    await new Promise((resolve) => setTimeout(resolve, 50));

    await withTenant(orgA, mockDb, async () => {
      const deliveries = await dbStore.webhookDeliveries.findMany();
      expect(deliveries.map((d) => d.event)).toContain(
        "opportunity.campaign_influence.created",
      );
      expect(deliveries.map((d) => d.event)).toContain(
        "opportunity.campaign_influence.deleted",
      );
    });
  });

  it("should calculate campaign attribution revenue only for closed-won opportunities", async () => {
    let oppIdWon = "";
    let oppIdOpen = "";
    let campaignId = "";

    await withTenant(orgA, mockDb, async () => {
      const campaign = await dbStore.campaigns.insert({
        orgId: orgA,
        name: "Attribution Campaign",
        status: "Active",
        type: "Webinar",
        isActive: 1,
        startDate: null,
        endDate: null,
        budgetedCost: "1000.00",
        actualCost: "800.00",
        expectedRevenue: "10000.00",
        createdAt: new Date(),
      });
      campaignId = campaign.id;

      const oppWon = await dbStore.opportunities.insert({
        orgId: orgA,
        ownerId: "user-a",
        name: "Closed Won Opp",
        stage: "Closed Won",
        amount: "100000.00",
        closeDate: null,
        custom: null,
      });
      oppIdWon = oppWon.id;

      const oppOpen = await dbStore.opportunities.insert({
        orgId: orgA,
        ownerId: "user-a",
        name: "Open Opp",
        stage: "Prospecting",
        amount: "50000.00",
        closeDate: null,
        custom: null,
      });
      oppIdOpen = oppOpen.id;

      // Direct mock insert for influence records
      await dbStore.campaignInfluence.insert({
        orgId: orgA,
        opportunityId: oppIdWon,
        campaignId,
        influencePercentage: 50,
        revenueShare: "50000.00",
      });

      await dbStore.campaignInfluence.insert({
        orgId: orgA,
        opportunityId: oppIdOpen,
        campaignId,
        influencePercentage: 40,
        revenueShare: "20000.00",
      });
    });

    const resAttribution = await app.request(
      `/api/campaigns/${campaignId}/attribution`,
      {
        method: "GET",
        headers: { Authorization: `Bearer ${tokenTenantA}` },
      },
    );
    expect(resAttribution.status).toBe(200);
    const bodyAttribution = await resAttribution.json();
    expect(bodyAttribution.success).toBe(true);
    // Only the Won Opportunity's 50000.00 should be counted
    expect(bodyAttribution.data.totalRevenueAttributed).toBe("50000.00");
  });

  it("should enforce strict Row-Level Security (RLS) tenant isolation", async () => {
    let oppIdA = "";
    let campaignIdA = "";
    let influenceIdA = "";

    // 1. Set up Tenant A
    await withTenant(orgA, mockDb, async () => {
      const opp = await dbStore.opportunities.insert({
        orgId: orgA,
        ownerId: "user-a",
        name: "Tenant A Opportunity",
        stage: "Prospecting",
        amount: "10000.00",
        closeDate: null,
        custom: null,
      });
      oppIdA = opp.id;

      const camp = await dbStore.campaigns.insert({
        orgId: orgA,
        name: "Tenant A Campaign",
        status: "Active",
        type: "Webinar",
        isActive: 1,
        startDate: null,
        endDate: null,
        budgetedCost: "1000.00",
        actualCost: "800.00",
        expectedRevenue: "10000.00",
        createdAt: new Date(),
      });
      campaignIdA = camp.id;

      const influence = await dbStore.campaignInfluence.insert({
        orgId: orgA,
        opportunityId: oppIdA,
        campaignId: campaignIdA,
        influencePercentage: 50,
        revenueShare: "5000.00",
      });
      influenceIdA = influence.id;
    });

    // 2. Set up Tenant B
    let _oppIdB = "";
    await withTenant(orgB, mockDb, async () => {
      const opp = await dbStore.opportunities.insert({
        orgId: orgB,
        ownerId: "user-b",
        name: "Tenant B Opportunity",
        stage: "Prospecting",
        amount: "20000.00",
        closeDate: null,
        custom: null,
      });
      _oppIdB = opp.id;
    });

    // Tenant B attempts to read Tenant A's campaign influences
    const resGetLeak = await app.request(
      `/api/opportunities/${oppIdA}/campaign-influence`,
      {
        method: "GET",
        headers: { Authorization: `Bearer ${tokenTenantB}` },
      },
    );
    // Should be Opportunity Not Found because finding opportunity first filters it under Tenant B context
    expect(resGetLeak.status).toBe(404);

    // Tenant B attempts to mutate Tenant A's campaign influences
    const resPostLeak = await app.request(
      `/api/opportunities/${oppIdA}/campaign-influence`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenTenantB}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          campaignId: campaignIdA,
          influencePercentage: 30,
        }),
      },
    );
    expect(resPostLeak.status).toBe(404);

    // Tenant B attempts to delete Tenant A's campaign influence
    const resDeleteLeak = await app.request(
      `/api/opportunities/${oppIdA}/campaign-influence/${influenceIdA}`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${tokenTenantB}` },
      },
    );
    expect(resDeleteLeak.status).toBe(404);
  });
});
