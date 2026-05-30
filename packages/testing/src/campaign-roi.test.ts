import { createSessionToken } from "@crm/auth";
import { dbStore, mockDb, withTenant } from "@crm/db";
import { beforeEach, describe, expect, it } from "vitest";
import { createTestApp } from "./_harness";

const app = createTestApp();

describe("Campaign ROI & Performance Analytics API Tests", () => {
  let tokenTenantA: string;
  let tokenTenantB: string;

  const orgA = "org-tenant-a";
  const orgB = "org-tenant-b";

  beforeEach(async () => {
    // Clear in-memory database store
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

  it("should calculate correct ROI metrics for a campaign under active tenant RLS isolation", async () => {
    // 1. Setup Tenant A campaign, members, opportunities, and campaign influences
    let campaignId = "";
    let _opp1Id = "";
    let _opp2Id = "";

    await withTenant(orgA, mockDb, async () => {
      const camp = await dbStore.campaigns.insert({
        orgId: orgA,
        name: "Spring Product Launch",
        status: "Active",
        type: "Email",
        isActive: 1,
        startDate: new Date("2026-03-01"),
        endDate: new Date("2026-06-01"),
        budgetedCost: "1000.00",
        actualCost: "1200.00",
        expectedRevenue: "5000.00",
      });
      campaignId = camp.id;

      // Add campaign members
      await dbStore.campaignMembers.insert({
        orgId: orgA,
        campaignId: camp.id,
        leadId: "lead-1",
        contactId: null,
        status: "Sent",
      });

      await dbStore.campaignMembers.insert({
        orgId: orgA,
        campaignId: camp.id,
        leadId: null,
        contactId: "contact-1",
        status: "Responded",
      });

      await dbStore.campaignMembers.insert({
        orgId: orgA,
        campaignId: camp.id,
        leadId: "lead-2",
        contactId: null,
        status: "Responded",
      });

      // Create Opportunities
      const acc = await dbStore.accounts.insert({
        orgId: orgA,
        ownerId: "user-a",
        name: "Acme Corp",
        domain: "acme.com",
        custom: null,
      });

      const opp1 = await dbStore.opportunities.insert({
        orgId: orgA,
        ownerId: "user-a",
        accountId: acc.id,
        name: "Acme Deal 1",
        stage: "Closed Won",
        amount: "3000.00",
        closeDate: new Date(),
        custom: null,
      });
      _opp1Id = opp1.id;

      const opp2 = await dbStore.opportunities.insert({
        orgId: orgA,
        ownerId: "user-a",
        accountId: acc.id,
        name: "Acme Deal 2",
        stage: "Closed Won",
        amount: "1500.00",
        closeDate: new Date(),
        custom: null,
      });
      _opp2Id = opp2.id;

      const opp3 = await dbStore.opportunities.insert({
        orgId: orgA,
        ownerId: "user-a",
        accountId: acc.id,
        name: "Acme Deal 3",
        stage: "Qualification",
        amount: "5000.00",
        closeDate: new Date(),
        custom: null,
      });

      // Add Campaign Influences
      await dbStore.campaignInfluence.insert({
        orgId: orgA,
        opportunityId: opp1.id,
        campaignId: camp.id,
        influencePercentage: 50,
        revenueShare: "1500.00",
      });

      await dbStore.campaignInfluence.insert({
        orgId: orgA,
        opportunityId: opp2.id,
        campaignId: camp.id,
        influencePercentage: 100,
        revenueShare: "1500.00",
      });

      await dbStore.campaignInfluence.insert({
        orgId: orgA,
        opportunityId: opp3.id,
        campaignId: camp.id,
        influencePercentage: 20,
        revenueShare: "1000.00",
      });
    });

    // 2. Fetch campaign ROI for Tenant A
    const res = await app.request(`/api/campaigns/${campaignId}/roi`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${tokenTenantA}`,
      },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);

    const metrics = body.data;
    expect(metrics.campaignId).toBe(campaignId);
    expect(metrics.campaignName).toBe("Spring Product Launch");
    expect(metrics.budgetedCost).toBe(1000);
    expect(metrics.actualCost).toBe(1200);
    expect(metrics.expectedRevenue).toBe(5000);
    expect(metrics.totalMembers).toBe(3);
    expect(metrics.respondedMembers).toBe(2);
    expect(metrics.wonOpportunitiesCount).toBe(2);
    expect(metrics.wonRevenueShareSum).toBe(3000); // 1500 + 1500
    expect(metrics.netValue).toBe(1800); // 3000 won share - 1200 actual cost
    expect(metrics.roi).toBe(150); // (1800 net / 1200 cost) * 100
  });

  it("should enforce RLS boundaries and block Tenant B from accessing Tenant A's campaign ROI stats", async () => {
    let campaignId = "";

    await withTenant(orgA, mockDb, async () => {
      const camp = await dbStore.campaigns.insert({
        orgId: orgA,
        name: "Confidential Launch",
        status: "Active",
        type: "Email",
        isActive: 1,
        startDate: new Date("2026-03-01"),
        endDate: new Date("2026-06-01"),
        budgetedCost: "1000.00",
        actualCost: "1200.00",
        expectedRevenue: "5000.00",
      });
      campaignId = camp.id;
    });

    // Tenant B attempts to fetch Tenant A's campaign ROI -> Should return 404 Campaign not found
    const res = await app.request(`/api/campaigns/${campaignId}/roi`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${tokenTenantB}`,
      },
    });
    expect(res.status).toBe(404);
  });

  it("should handle zero cost correctly and return 0% ROI without dividing by zero", async () => {
    let campaignId = "";

    await withTenant(orgA, mockDb, async () => {
      const camp = await dbStore.campaigns.insert({
        orgId: orgA,
        name: "Free Campaign",
        status: "Active",
        type: "Webinar",
        isActive: 1,
        startDate: new Date(),
        endDate: new Date(),
        budgetedCost: "0.00",
        actualCost: "0.00",
        expectedRevenue: "0.00",
      });
      campaignId = camp.id;
    });

    const res = await app.request(`/api/campaigns/${campaignId}/roi`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${tokenTenantA}`,
      },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.roi).toBe(0);
    expect(body.data.netValue).toBe(0);
  });
});
