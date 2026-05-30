import { createSessionToken } from "@crm/auth";
import { dbStore, mockDb, store, withTenant } from "@crm/db";
import { beforeEach, describe, expect, it } from "vitest";
import { createTestApp } from "./_harness";

const app = createTestApp();

describe("Opportunity Stage History & Velocity Tracking REST API Tests", () => {
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

  it("should log history and enforce RLS when creating and updating opportunities", async () => {
    // 1. Create Account for Tenant A
    let accountIdA = "";
    await withTenant(orgA, mockDb, async () => {
      const acc = await dbStore.accounts.insert({
        orgId: orgA,
        ownerId: "user-a",
        name: "Acme Enterprise",
        domain: "acme.com",
        custom: null,
      });
      accountIdA = acc.id;
    });

    // 2. Create Opportunity for Tenant A (POST /api/opportunities)
    const createRes = await app.request("/api/opportunities", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenTenantA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "Acme Software Q3 Deal",
        stage: "Prospecting",
        accountId: accountIdA,
        amount: 25000,
      }),
    });

    expect(createRes.status).toBe(200);
    const createBody = await createRes.json();
    expect(createBody.success).toBe(true);
    const oppId = createBody.data.id;
    expect(oppId).toBeDefined();

    // 3. Fetch Stage History for the new opportunity -> should contain exactly 1 entry with fromStage = null
    const historyResA1 = await app.request(
      `/api/opportunities/${oppId}/stage-history`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${tokenTenantA}`,
        },
      },
    );

    expect(historyResA1.status).toBe(200);
    const historyBodyA1 = await historyResA1.json();
    expect(historyBodyA1.success).toBe(true);
    expect(historyBodyA1.data.length).toBe(1);
    expect(historyBodyA1.data[0].fromStage).toBeNull();
    expect(historyBodyA1.data[0].toStage).toBe("Prospecting");
    expect(historyBodyA1.data[0].amount).toBe("25000");

    // 4. Update the Opportunity Stage (PATCH /api/opportunities/:id) to Qualification
    const patchRes = await app.request(`/api/opportunities/${oppId}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${tokenTenantA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        stage: "Qualification",
        amount: 30000,
      }),
    });

    expect(patchRes.status).toBe(200);
    const patchBody = await patchRes.json();
    expect(patchBody.success).toBe(true);

    // 5. Fetch Stage History again -> should contain 2 entries
    const historyResA2 = await app.request(
      `/api/opportunities/${oppId}/stage-history`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${tokenTenantA}`,
        },
      },
    );

    expect(historyResA2.status).toBe(200);
    const historyBodyA2 = await historyResA2.json();
    expect(historyBodyA2.success).toBe(true);
    expect(historyBodyA2.data.length).toBe(2);

    // Sorted chronologically:
    // Entry 0: fromStage: null, toStage: Prospecting
    expect(historyBodyA2.data[0].fromStage).toBeNull();
    expect(historyBodyA2.data[0].toStage).toBe("Prospecting");

    // Entry 1: fromStage: Prospecting, toStage: Qualification, amount: 30000 (after patch update)
    expect(historyBodyA2.data[1].fromStage).toBe("Prospecting");
    expect(historyBodyA2.data[1].toStage).toBe("Qualification");
    expect(historyBodyA2.data[1].amount).toBe("30000");

    // 6. Cross-Tenant Verification: Tenant B should not be able to read Tenant A's opportunity stage history
    const historyResB = await app.request(
      `/api/opportunities/${oppId}/stage-history`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${tokenTenantB}`,
        },
      },
    );
    expect(historyResB.status).toBe(404); // returns Opportunity not found
  });

  it("should calculate correct stage velocity reporting under RLS isolation", async () => {
    const oppId1 = "opp-1";
    const oppId2 = "opp-2";

    // Setup historic stage changes with manual timestamps for Tenant A
    const now = new Date();
    const oneDay = 24 * 60 * 60 * 1000;

    await withTenant(orgA, mockDb, async () => {
      // Create Opportunity 1
      await dbStore.opportunities.insert({
        orgId: orgA,
        ownerId: "user-a",
        accountId: "acc-1",
        name: "Deal Alpha",
        stage: "Closed Won",
        amount: "10000",
        closeDate: null,
        custom: null,
      });

      // Insert transition logs manually for Deal Alpha (total 4 days in Prospecting, 2 days in Qualification)
      store.opportunityStageHistory.push({
        id: "h1",
        orgId: orgA,
        opportunityId: oppId1,
        fromStage: null,
        toStage: "Prospecting",
        amount: "10000",
        changedById: "user-a",
        createdAt: new Date(now.getTime() - 6 * oneDay),
      });

      store.opportunityStageHistory.push({
        id: "h2",
        orgId: orgA,
        opportunityId: oppId1,
        fromStage: "Prospecting",
        toStage: "Qualification",
        amount: "10000",
        changedById: "user-a",
        createdAt: new Date(now.getTime() - 2 * oneDay),
      });

      store.opportunityStageHistory.push({
        id: "h3",
        orgId: orgA,
        opportunityId: oppId1,
        fromStage: "Qualification",
        toStage: "Closed Won",
        amount: "10000",
        changedById: "user-a",
        createdAt: new Date(now.getTime() - 1 * oneDay),
      });
    });

    await withTenant(orgB, mockDb, async () => {
      // Create Opportunity 2 for Tenant B
      await dbStore.opportunities.insert({
        orgId: orgB,
        ownerId: "user-b",
        accountId: "acc-2",
        name: "Deal Beta",
        stage: "Prospecting",
        amount: "5000",
        closeDate: null,
        custom: null,
      });

      // Insert transition log for Deal Beta (Tenant B) -> should not affect Tenant A's velocity metrics
      store.opportunityStageHistory.push({
        id: "h4",
        orgId: orgB,
        opportunityId: oppId2,
        fromStage: null,
        toStage: "Prospecting",
        amount: "5000",
        changedById: "user-b",
        createdAt: new Date(now.getTime() - 10 * oneDay),
      });
    });

    // 1. GET /api/reports/stage-velocity for Tenant A
    const velocityResA = await app.request("/api/reports/stage-velocity", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${tokenTenantA}`,
      },
    });

    expect(velocityResA.status).toBe(200);
    const velocityBodyA = await velocityResA.json();
    expect(velocityBodyA.success).toBe(true);

    const reportA = velocityBodyA.data;
    // Prospecting velocity: h1 (T-6d) to h2 (T-2d) -> 4 days
    expect(reportA.Prospecting).toBeDefined();
    expect(reportA.Prospecting.averageDurationDays).toBe(4);
    expect(reportA.Prospecting.transitionCount).toBe(1);

    // Qualification velocity: h2 (T-2d) to h3 (T-1d) -> 1 day
    expect(reportA.Qualification).toBeDefined();
    expect(reportA.Qualification.averageDurationDays).toBe(1);
    expect(reportA.Qualification.transitionCount).toBe(1);

    // Closed Won is terminal and has no duration
    expect(reportA["Closed Won"]).toBeDefined();
    expect(reportA["Closed Won"].averageDurationDays).toBe(0);

    // 2. GET /api/reports/stage-velocity for Tenant B
    const velocityResB = await app.request("/api/reports/stage-velocity", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${tokenTenantB}`,
      },
    });

    expect(velocityResB.status).toBe(200);
    const velocityBodyB = await velocityResB.json();
    expect(velocityBodyB.success).toBe(true);

    const reportB = velocityBodyB.data;
    // Prospecting velocity: h4 (T-10d) to now (T-0d) -> 10 days
    expect(reportB.Prospecting).toBeDefined();
    expect(reportB.Prospecting.averageDurationDays).toBeCloseTo(10, 0.1);
    expect(reportB.Prospecting.transitionCount).toBe(1);

    // Tenant B report should not contain Tenant A's Qualification or Closed Won metrics
    expect(reportB.Qualification).toBeUndefined();
    expect(reportB["Closed Won"]).toBeUndefined();
  });
});
