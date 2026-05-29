import { createSessionToken } from "@crm/auth";
import { dbStore, mockDb, withTenant } from "@crm/db";
import { beforeEach, describe, expect, it } from "vitest";
import app from "../../../apps/api/src/index";

describe("Campaigns & Campaign Members REST API Tests", () => {
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

  it("should support creating, listing, and retrieving campaigns isolated by tenant RLS", async () => {
    // 1. POST /api/campaigns for Tenant A
    const createRes = await app.request("/api/campaigns", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenTenantA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "Summer Blast 2026",
        status: "Active",
        type: "Email",
        isActive: 1,
        budgetedCost: "5000.00",
        actualCost: "4000.00",
        expectedRevenue: "25000.00",
      }),
    });

    expect(createRes.status).toBe(200);
    const createBody = await createRes.json();
    expect(createBody.success).toBe(true);
    expect(createBody.data.id).toBeDefined();
    expect(createBody.data.name).toBe("Summer Blast 2026");
    expect(createBody.data.actualCost).toBe("4000.00");

    const campaignId = createBody.data.id;

    // 2. GET /api/campaigns for Tenant A -> returns the newly created campaign
    const listResA = await app.request("/api/campaigns", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${tokenTenantA}`,
      },
    });
    expect(listResA.status).toBe(200);
    const listBodyA = await listResA.json();
    expect(listBodyA.data.length).toBe(1);
    expect(listBodyA.data[0].id).toBe(campaignId);

    // 3. GET /api/campaigns for Tenant B -> returns empty list
    const listResB = await app.request("/api/campaigns", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${tokenTenantB}`,
      },
    });
    expect(listResB.status).toBe(200);
    const listBodyB = await listResB.json();
    expect(listBodyB.data.length).toBe(0);

    // 4. GET /api/campaigns/:id for Tenant B -> returns 404
    const getResB = await app.request(`/api/campaigns/${campaignId}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${tokenTenantB}`,
      },
    });
    expect(getResB.status).toBe(404);
  });

  it("should enforce RLS boundaries when registering campaign members and calculating ROI", async () => {
    let campaignIdA = "";
    let leadIdA = "";
    let leadIdB = "";
    let accountIdA = "";

    // 1. Setup entities for Tenant A and Tenant B
    await withTenant(orgA, mockDb, async () => {
      const camp = await dbStore.campaigns.insert({
        orgId: orgA,
        name: "Q2 Webinar",
        status: "Active",
        type: "Webinar",
        isActive: 1,
        budgetedCost: "2000.00",
        actualCost: "1000.00",
        expectedRevenue: "10000.00",
        startDate: null,
        endDate: null,
      });
      campaignIdA = camp.id;

      const lead = await dbStore.leads.insert({
        orgId: orgA,
        ownerId: "user-a",
        status: "New",
        email: "lead-a@test.com",
        company: "Acme Corp",
        convertedAccountId: null,
        convertedContactId: null,
        custom: null,
      });
      leadIdA = lead.id;

      const acc = await dbStore.accounts.insert({
        orgId: orgA,
        ownerId: "user-a",
        name: "Acme Corp Account",
        domain: "acme.com",
        custom: null,
      });
      accountIdA = acc.id;
    });

    await withTenant(orgB, mockDb, async () => {
      const lead = await dbStore.leads.insert({
        orgId: orgB,
        ownerId: "user-b",
        status: "New",
        email: "lead-b@test.com",
        company: "Beta Corp",
        convertedAccountId: null,
        convertedContactId: null,
        custom: null,
      });
      leadIdB = lead.id;
    });

    // 2. Add Tenant A Lead as a Member to Campaign A (Success)
    const addMemberResA = await app.request(
      `/api/campaigns/${campaignIdA}/members`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenTenantA}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          leadId: leadIdA,
          status: "Sent",
        }),
      },
    );
    expect(addMemberResA.status).toBe(200);
    const addMemberBodyA = await addMemberResA.json();
    expect(addMemberBodyA.success).toBe(true);
    expect(addMemberBodyA.data.leadId).toBe(leadIdA);

    const memberId = addMemberBodyA.data.id;

    // 3. Prevent duplicate campaign member registration
    const addDupRes = await app.request(
      `/api/campaigns/${campaignIdA}/members`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenTenantA}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          leadId: leadIdA,
          status: "Sent",
        }),
      },
    );
    expect(addDupRes.status).toBe(400);

    // 4. Try adding Tenant B's Lead to Campaign A (Fails RLS)
    const addMemberResB = await app.request(
      `/api/campaigns/${campaignIdA}/members`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenTenantA}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          leadId: leadIdB,
        }),
      },
    );
    expect(addMemberResB.status).toBe(404); // returns Lead not found due to RLS

    // 5. Query stats for Campaign A (Verify members stats)
    const getCampA1 = await app.request(`/api/campaigns/${campaignIdA}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${tokenTenantA}`,
      },
    });
    expect(getCampA1.status).toBe(200);
    const campBodyA1 = await getCampA1.json();
    expect(campBodyA1.data.stats.totalMembers).toBe(1);
    expect(campBodyA1.data.stats.respondedMembers).toBe(0);
    expect(campBodyA1.data.stats.responseRate).toBe(0);
    expect(campBodyA1.data.stats.totalClosedWonRevenue).toBe("0.00");
    expect(campBodyA1.data.stats.netRevenueRoi).toBe("-100.00");

    // 6. Update Campaign Member status to Responded
    const updateStatusRes = await app.request(
      `/api/campaigns/${campaignIdA}/members/${memberId}/status`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenTenantA}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          status: "Responded",
        }),
      },
    );
    expect(updateStatusRes.status).toBe(200);
    const updateStatusBody = await updateStatusRes.json();
    expect(updateStatusBody.success).toBe(true);
    expect(updateStatusBody.data.status).toBe("Responded");

    // 7. Setup opportunities linked to Campaign A
    await withTenant(orgA, mockDb, async () => {
      // Won opportunity
      await dbStore.opportunities.insert({
        orgId: orgA,
        ownerId: "user-a",
        accountId: accountIdA,
        campaignId: campaignIdA,
        name: "Won Big Deal",
        stage: "Closed Won",
        amount: "5000.00",
        closeDate: null,
        custom: null,
      });

      // Pipeline opportunity (should not count towards won revenue)
      await dbStore.opportunities.insert({
        orgId: orgA,
        ownerId: "user-a",
        accountId: accountIdA,
        campaignId: campaignIdA,
        name: "Prospecting Deal",
        stage: "Prospecting",
        amount: "3000.00",
        closeDate: null,
        custom: null,
      });
    });

    // 8. Re-query stats and assert ROI/attribution calculation
    const getCampA2 = await app.request(`/api/campaigns/${campaignIdA}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${tokenTenantA}`,
      },
    });
    expect(getCampA2.status).toBe(200);
    const campBodyA2 = await getCampA2.json();
    expect(campBodyA2.data.stats.totalMembers).toBe(1);
    expect(campBodyA2.data.stats.respondedMembers).toBe(1);
    expect(campBodyA2.data.stats.responseRate).toBe(100);
    expect(campBodyA2.data.stats.totalClosedWonRevenue).toBe("5000.00");
    // ROI = ((5000 won - 1000 actualCost) / 1000 actualCost) * 100 = 400.00%
    expect(campBodyA2.data.stats.netRevenueRoi).toBe("400.00");
  });
});
