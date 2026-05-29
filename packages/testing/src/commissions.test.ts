import { createSessionToken } from "@crm/auth";
import { dbStore, mockDb, withTenant } from "@crm/db";
import { beforeEach, describe, expect, it } from "vitest";
import app from "../../../apps/api/src/index";

describe("Sales Commission Calculation & RLS Boundaries", () => {
  let tokenTenantA: string;
  let tokenTenantB: string;
  const orgA = "org-tenant-a";
  const orgB = "org-tenant-b";
  const userA = "user-a";
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

  it("should block commission calculations on opportunities that are not Closed Won", async () => {
    let oppId = "";
    await withTenant(orgA, mockDb, async () => {
      const opp = await dbStore.opportunities.insert({
        orgId: orgA,
        ownerId: userA,
        accountId: null,
        name: "Enterprise Negotiation Deal",
        stage: "Negotiation",
        amount: "50000.00",
        closeDate: new Date("2026-05-15"),
        custom: null,
      });
      oppId = opp.id;
    });

    const res = await app.request("/api/commissions/calculate", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenTenantA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ opportunityId: oppId }),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain(
      "Commission can only be calculated for Closed Won opportunities",
    );
  });

  it("should calculate standard flat commissions and tier-based multipliers correctly based on quota attainment", async () => {
    let opp1Id = "";
    let opp2Id = "";
    let opp3Id = "";

    // 1. Establish quota target for Tenant A user in period "2026-05" -> $100,000.00
    await withTenant(orgA, mockDb, async () => {
      await dbStore.quotas.insert({
        orgId: orgA,
        userId: userA,
        period,
        targetAmount: "100000.00",
      });
    });

    // 2. Insert First Closed Won Opportunity and calculate Commission (amount $50k / quota $100k -> 50% attainment -> no multiplier)
    // Rate applied: 5% (0.05). Commission payout: 50,000.00 * 0.05 = 2,500.00
    await withTenant(orgA, mockDb, async () => {
      const opp1 = await dbStore.opportunities.insert({
        orgId: orgA,
        ownerId: userA,
        accountId: null,
        name: "First Won Deal",
        stage: "Closed Won",
        amount: "50000.00",
        closeDate: new Date("2026-05-10"),
        custom: null,
      });
      opp1Id = opp1.id;
    });

    const res1 = await app.request("/api/commissions/calculate", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenTenantA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ opportunityId: opp1Id }),
    });

    expect(res1.status).toBe(200);
    const body1 = await res1.json();
    expect(body1.success).toBe(true);
    expect(body1.data.amount).toBe("2500.00");
    expect(body1.data.rateApplied).toBe("0.0500");
    expect(body1.data.status).toBe("Pending");

    // 3. Insert Second Closed Won Opportunity and calculate Commission (amount $60k -> cumulative $110k -> 110% attainment -> 1.2x boost)
    // Effective Rate: 5% * 1.2 = 6% (0.06). Commission payout: 60,000.00 * 0.06 = 3,600.00
    await withTenant(orgA, mockDb, async () => {
      const opp2 = await dbStore.opportunities.insert({
        orgId: orgA,
        ownerId: userA,
        accountId: null,
        name: "Second Won Deal",
        stage: "Closed Won",
        amount: "60000.00",
        closeDate: new Date("2026-05-18"),
        custom: null,
      });
      opp2Id = opp2.id;
    });

    const res2 = await app.request("/api/commissions/calculate", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenTenantA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ opportunityId: opp2Id }),
    });

    expect(res2.status).toBe(200);
    const body2 = await res2.json();
    expect(body2.success).toBe(true);
    expect(body2.data.amount).toBe("3600.00");
    expect(body2.data.rateApplied).toBe("0.0600");

    // 4. Insert Third Closed Won Opportunity and calculate Commission (amount $50k -> cumulative $160k -> 160% attainment -> 1.5x boost)
    // Effective Rate: 5% * 1.5 = 7.5% (0.075). Commission payout: 50,000.00 * 0.075 = 3,750.00
    await withTenant(orgA, mockDb, async () => {
      const opp3 = await dbStore.opportunities.insert({
        orgId: orgA,
        ownerId: userA,
        accountId: null,
        name: "Third Won Deal",
        stage: "Closed Won",
        amount: "50000.00",
        closeDate: new Date("2026-05-25"),
        custom: null,
      });
      opp3Id = opp3.id;
    });

    // Effective Rate: 5% * 1.5 = 7.5% (0.075). Commission payout: 50,000.00 * 0.075 = 3,750.00
    const res3 = await app.request("/api/commissions/calculate", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenTenantA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ opportunityId: opp3Id }),
    });

    expect(res3.status).toBe(200);
    const body3 = await res3.json();
    expect(body3.success).toBe(true);
    expect(body3.data.amount).toBe("3750.00");
    expect(body3.data.rateApplied).toBe("0.0750");

    // 5. Query active tenant commissions list
    const listRes = await app.request("/api/commissions", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${tokenTenantA}`,
      },
    });
    expect(listRes.status).toBe(200);
    const listBody = await listRes.json();
    expect(listBody.success).toBe(true);
    expect(listBody.data.length).toBe(3);

    // 6. Approve the first commission payout
    const commId = body1.data.id;
    const approveRes = await app.request(`/api/commissions/${commId}/approve`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenTenantA}`,
      },
    });
    expect(approveRes.status).toBe(200);
    const approveBody = await approveRes.json();
    expect(approveBody.success).toBe(true);
    expect(approveBody.data.status).toBe("Approved");

    // 7. Verify standard audit logs were recorded
    await withTenant(orgA, mockDb, async () => {
      const audits = await dbStore.auditLogs.findMany();
      expect(
        audits.some((a) => a.recordId === commId && a.action === "calculate"),
      ).toBe(true);
      expect(
        audits.some((a) => a.recordId === commId && a.action === "approve"),
      ).toBe(true);
    });
  });

  it("should strictly isolate multi-tenant operations at RLS store boundaries", async () => {
    let oppIdA = "";
    let commIdA = "";

    // 1. Tenant A creates Closed Won opportunity and calculates commission
    await withTenant(orgA, mockDb, async () => {
      const opp = await dbStore.opportunities.insert({
        orgId: orgA,
        ownerId: userA,
        accountId: null,
        name: "Tenant A Deal",
        stage: "Closed Won",
        amount: "10000.00",
        closeDate: new Date("2026-05-12"),
        custom: null,
      });
      oppIdA = opp.id;
    });

    const calculateRes = await app.request("/api/commissions/calculate", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenTenantA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ opportunityId: oppIdA }),
    });
    const calcBody = await calculateRes.json();
    commIdA = calcBody.data.id;

    // 2. Tenant B attempts to calculate commission on Tenant A's opportunity -> 404 (not found / isolated)
    const calculateResB = await app.request("/api/commissions/calculate", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenTenantB}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ opportunityId: oppIdA }),
    });
    expect(calculateResB.status).toBe(404);

    // 3. Tenant B attempts to fetch Tenant A's commission records -> 404/Empty (isolated)
    const listResB = await app.request("/api/commissions", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${tokenTenantB}`,
      },
    });
    const listBodyB = await listResB.json();
    expect(listBodyB.data.some((c: { id: string }) => c.id === commIdA)).toBe(
      false,
    );

    // 4. Tenant B attempts to approve Tenant A's commission payout -> 404 (isolated)
    const approveResB = await app.request(
      `/api/commissions/${commIdA}/approve`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenTenantB}`,
        },
      },
    );
    expect(approveResB.status).toBe(404);
  });
});
