import { createSessionToken } from "@crm/auth";
import { type DBCommission, dbStore, mockDb, withTenant } from "@crm/db";
import { beforeEach, describe, expect, it } from "vitest";
import { createTestApp } from "./_harness";

const app = createTestApp();

describe("Opportunity Splits & Multi-Rep Commission Allocation", () => {
  let tokenTenantA: string;
  let tokenTenantB: string;
  const orgA = "org-tenant-a";
  const orgB = "org-tenant-b";
  const userA = "user-a";
  const userA2 = "user-a2";
  const userB = "user-b";
  const period = "2026-05";

  beforeEach(async () => {
    dbStore.clear();

    tokenTenantA = await createSessionToken({
      userId: userA,
      orgId: orgA,
      roleId: "role-sales-rep-a",
      permissionsMask: 7,
    });

    tokenTenantB = await createSessionToken({
      userId: userB,
      orgId: orgB,
      roleId: "role-sales-rep-b",
      permissionsMask: 7,
    });
  });

  it("should successfully set, get, and delete splits on an opportunity under Tenant A", async () => {
    let oppId = "";
    await withTenant(orgA, mockDb, async () => {
      const opp = await dbStore.opportunities.insert({
        orgId: orgA,
        ownerId: userA,
        accountId: null,
        name: "Joint Enterprise Deal",
        stage: "Qualification",
        amount: "100000.00",
        closeDate: new Date("2026-05-15"),
        custom: null,
      });
      oppId = opp.id;
    });

    // Define splits: User A gets 60%, User A2 gets 40%
    const postRes = await app.request(`/api/opportunities/${oppId}/splits`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenTenantA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        splits: [
          { userId: userA, percentage: 60 },
          { userId: userA2, percentage: 40 },
        ],
      }),
    });

    expect(postRes.status).toBe(200);
    const postBody = await postRes.json();
    expect(postBody.success).toBe(true);
    expect(postBody.data).toHaveLength(2);
    expect(
      postBody.data.find(
        (s: { userId: string; splitAmount: string }) => s.userId === userA,
      )?.splitAmount,
    ).toBe("60000.00");
    expect(
      postBody.data.find(
        (s: { userId: string; splitAmount: string }) => s.userId === userA2,
      )?.splitAmount,
    ).toBe("40000.00");

    // Fetch splits
    const getRes = await app.request(`/api/opportunities/${oppId}/splits`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${tokenTenantA}`,
      },
    });

    expect(getRes.status).toBe(200);
    const getBody = await getRes.json();
    expect(getBody.success).toBe(true);
    expect(getBody.data).toHaveLength(2);

    // Delete splits
    const delRes = await app.request(`/api/opportunities/${oppId}/splits`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${tokenTenantA}`,
      },
    });

    expect(delRes.status).toBe(200);
    const delBody = await delRes.json();
    expect(delBody.success).toBe(true);

    // Confirm no splits remaining
    const getResAfter = await app.request(
      `/api/opportunities/${oppId}/splits`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${tokenTenantA}`,
        },
      },
    );
    const getBodyAfter = await getResAfter.json();
    expect(getBodyAfter.data).toHaveLength(0);
  });

  it("should fail to set splits if total percentage does not sum to 100%", async () => {
    let oppId = "";
    await withTenant(orgA, mockDb, async () => {
      const opp = await dbStore.opportunities.insert({
        orgId: orgA,
        ownerId: userA,
        accountId: null,
        name: "Joint Deal",
        stage: "Qualification",
        amount: "100000.00",
        closeDate: new Date("2026-05-15"),
        custom: null,
      });
      oppId = opp.id;
    });

    const res = await app.request(`/api/opportunities/${oppId}/splits`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenTenantA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        splits: [
          { userId: userA, percentage: 50 },
          { userId: userA2, percentage: 30 },
        ],
      }),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("Total split percentage must equal 100%");
  });

  it("should enforce RLS boundaries and block cross-tenant splits queries and mutations", async () => {
    let oppIdA = "";
    await withTenant(orgA, mockDb, async () => {
      const opp = await dbStore.opportunities.insert({
        orgId: orgA,
        ownerId: userA,
        accountId: null,
        name: "Tenant A Deal",
        stage: "Qualification",
        amount: "50000.00",
        closeDate: new Date("2026-05-15"),
        custom: null,
      });
      oppIdA = opp.id;
    });

    // Tenant B attempts to set splits on Tenant A's opportunity -> should fail/block
    const postRes = await app.request(`/api/opportunities/${oppIdA}/splits`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenTenantB}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        splits: [{ userId: userB, percentage: 100 }],
      }),
    });
    expect(postRes.status).toBe(404);

    // Tenant B attempts to insert split for a user of Tenant A -> should be blocked/error
    await withTenant(orgA, mockDb, async () => {
      await dbStore.opportunitySplits.insert({
        orgId: orgA,
        opportunityId: oppIdA,
        userId: userA,
        percentage: 100,
        splitAmount: "50000.00",
      });
    });

    // Check that Tenant B gets empty array when querying Tenant A's opportunity splits
    const getRes = await app.request(`/api/opportunities/${oppIdA}/splits`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${tokenTenantB}`,
      },
    });
    expect(getRes.status).toBe(404);
  });

  it("should calculate split commissions correctly for Closed Won deals and revert back to owner when splits deleted", async () => {
    let oppId = "";
    await withTenant(orgA, mockDb, async () => {
      // Setup quotas
      await dbStore.quotas.insert({
        orgId: orgA,
        userId: userA,
        period,
        targetAmount: "100000.00",
      });
      await dbStore.quotas.insert({
        orgId: orgA,
        userId: userA2,
        period,
        targetAmount: "100000.00",
      });

      const opp = await dbStore.opportunities.insert({
        orgId: orgA,
        ownerId: userA,
        accountId: null,
        name: "Collaborative Deal",
        stage: "Closed Won",
        amount: "100000.00",
        closeDate: new Date("2026-05-15"),
        custom: null,
      });
      oppId = opp.id;
    });

    // 1. Post splits: User A gets 70%, User A2 gets 30%
    const res = await app.request(`/api/opportunities/${oppId}/splits`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenTenantA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        splits: [
          { userId: userA, percentage: 70 },
          { userId: userA2, percentage: 30 },
        ],
      }),
    });
    expect(res.status).toBe(200);

    // Fetch commissions for Tenant A -> should show two commissions for userA and userA2
    let comms: DBCommission[] = [];
    await withTenant(orgA, mockDb, async () => {
      comms = await dbStore.commissions.findMany();
    });

    expect(comms).toHaveLength(2);
    const commA = comms.find((c) => c.userId === userA);
    const commA2 = comms.find((c) => c.userId === userA2);

    expect(commA).toBeDefined();
    expect(commA.amount).toBe("3500.00");
    expect(commA2).toBeDefined();
    expect(commA2.amount).toBe("1500.00");

    // 2. Delete splits -> should revert commission to Owner (userA) 100% of amount 100k
    const delRes = await app.request(`/api/opportunities/${oppId}/splits`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${tokenTenantA}`,
      },
    });
    expect(delRes.status).toBe(200);

    await withTenant(orgA, mockDb, async () => {
      comms = await dbStore.commissions.findMany();
    });
    expect(comms).toHaveLength(1);
    expect(comms[0].userId).toBe(userA);
    expect(comms[0].amount).toBe("6000.00");
  });
});
