import { createSessionToken } from "@crm/auth";
import { dbStore, mockDb, withTenant } from "@crm/db";
import {
  calculateQuotaAttainment,
  calculateWeightedAmount,
  compileForecastSummary,
} from "@crm/forecasting";
import { beforeEach, describe, expect, it } from "vitest";
import { createTestApp } from "./_harness";

const app = createTestApp();

describe("Sales Forecasting & Quota Engine - Core Unit Tests", () => {
  it("should correctly compute individual weighted opportunity values", () => {
    // Standard defaults: Prospecting is 10%, Proposal is 60%
    expect(calculateWeightedAmount("1000", "Prospecting")).toBe(100);
    expect(calculateWeightedAmount("5000", "Proposal")).toBe(3000);

    // Custom overrides: make Negotiation 90%
    const custom = { Negotiation: 90 };
    expect(calculateWeightedAmount("10000", "Negotiation", custom)).toBe(9000);

    // Handles null or empty values gracefully
    expect(calculateWeightedAmount(null, "Prospecting")).toBe(0);
    expect(calculateWeightedAmount("invalid", "Prospecting")).toBe(0);
  });

  it("should correctly compute quota attainment percentages", () => {
    expect(calculateQuotaAttainment(50000, 100000)).toBe(50.0);
    expect(calculateQuotaAttainment(120000, 100000)).toBe(120.0);
    expect(calculateQuotaAttainment(0, 50000)).toBe(0);
    expect(calculateQuotaAttainment(5000, 0)).toBe(0); // Handles divide-by-zero
  });

  it("should compile forecast summaries grouped chronologically by month", () => {
    const opps = [
      {
        id: "1",
        stage: "Prospecting",
        amount: "10000",
        closeDate: new Date("2026-05-10"),
      },
      {
        id: "2",
        stage: "Proposal",
        amount: "20000",
        closeDate: new Date("2026-05-20"),
      },
      {
        id: "3",
        stage: "Closed Won",
        amount: "5000",
        closeDate: new Date("2026-06-05"),
      },
      {
        id: "4",
        stage: "Closed Lost",
        amount: "8000",
        closeDate: new Date("2026-06-12"),
      },
    ];

    const result = compileForecastSummary({
      opportunities: opps,
      targetQuota: 25000,
    });

    // Total actual sum = 10000 + 20000 + 5000 + 8000 = 43000
    expect(result.totalPipelineAmount).toBe(43000);

    // Total weighted = (10000 * 10%) + (20000 * 60%) + (5000 * 100%) + 0 = 1000 + 12000 + 5000 = 18000
    expect(result.totalWeightedAmount).toBe(18000);

    // Attainment = (5000 / 25000) * 100 = 20%
    expect(result.attainmentPercentage).toBe(20.0);

    expect(result.byPeriod.length).toBe(2);
    expect(result.byPeriod[0].period).toBe("2026-05");
    expect(result.byPeriod[0].actualAmount).toBe(30000);
    expect(result.byPeriod[0].weightedAmount).toBe(13000);

    expect(result.byPeriod[1].period).toBe("2026-06");
    expect(result.byPeriod[1].actualAmount).toBe(13000);
    expect(result.byPeriod[1].weightedAmount).toBe(5000);
  });
});

describe("Sales Forecasting & Quota Engine - Integration REST API Tests", () => {
  let tokenA: string;
  let tokenB: string;

  const orgA = "org-tenant-a";
  const orgB = "org-tenant-b";

  beforeEach(async () => {
    dbStore.clear();

    tokenA = await createSessionToken({
      userId: "user-a",
      orgId: orgA,
      roleId: "role-a",
      permissionsMask: 7,
    });

    tokenB = await createSessionToken({
      userId: "user-b",
      orgId: orgB,
      roleId: "role-b",
      permissionsMask: 7,
    });
  });

  it("should allow creating, listing quotas and customizing stage win probabilities per tenant with RLS", async () => {
    // 1. POST /api/quotas for Tenant A
    const quotaResA = await app.request("/api/quotas", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        userId: "user-a",
        period: "2026-05",
        targetAmount: 50000,
      }),
    });
    expect(quotaResA.status).toBe(200);
    const quotaDataA = await quotaResA.json();
    expect(quotaDataA.success).toBe(true);
    expect(quotaDataA.data.targetAmount).toBe("50000");

    // 2. GET /api/quotas for Tenant A -> returns 1 item
    const quotasGetA = await app.request("/api/quotas", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${tokenA}`,
      },
    });
    expect(quotasGetA.status).toBe(200);
    const quotasDataGetA = await quotasGetA.json();
    expect(quotasDataGetA.success).toBe(true);
    expect(quotasDataGetA.data.length).toBe(1);

    // 3. GET /api/quotas for Tenant B -> returns 0 items (isolated!)
    const quotasGetB = await app.request("/api/quotas", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${tokenB}`,
      },
    });
    expect(quotasGetB.status).toBe(200);
    const quotasDataGetB = await quotasGetB.json();
    expect(quotasDataGetB.success).toBe(true);
    expect(quotasDataGetB.data.length).toBe(0);

    // 4. POST /api/forecasting/probabilities for Tenant A
    const probResA = await app.request("/api/forecasting/probabilities", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        stage: "Prospecting",
        probability: 15,
      }),
    });
    expect(probResA.status).toBe(200);
    const probDataA = await probResA.json();
    expect(probDataA.success).toBe(true);
    expect(probDataA.data.probability).toBe(15);

    // 5. GET /api/forecasting/probabilities for Tenant B -> isolated (returns empty)
    const probsGetB = await app.request("/api/forecasting/probabilities", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${tokenB}`,
      },
    });
    expect(probsGetB.status).toBe(200);
    const probsDataGetB = await probsGetB.json();
    expect(probsDataGetB.success).toBe(true);
    expect(probsDataGetB.data.length).toBe(0);
  });

  it("should accurately generate forecast summaries with period filters and active quotas", async () => {
    // Set up opportunities and quotas inside Tenant A RLS boundary
    await withTenant(orgA, mockDb, async () => {
      await dbStore.quotas.insert({
        orgId: orgA,
        userId: "user-a",
        period: "2026-05",
        targetAmount: "100000",
      });

      await dbStore.opportunities.insert({
        orgId: orgA,
        ownerId: "user-a",
        accountId: "acc-id",
        name: "Opp A",
        stage: "Closed Won",
        amount: "30000",
        closeDate: new Date("2026-05-15"),
        custom: null,
      });

      await dbStore.opportunities.insert({
        orgId: orgA,
        ownerId: "user-a",
        accountId: "acc-id",
        name: "Opp B",
        stage: "Proposal",
        amount: "50000",
        closeDate: new Date("2026-05-20"),
        custom: null,
      });

      // Opportunity outside period
      await dbStore.opportunities.insert({
        orgId: orgA,
        ownerId: "user-a",
        accountId: "acc-id",
        name: "Opp C",
        stage: "Proposal",
        amount: "40000",
        closeDate: new Date("2026-06-10"),
        custom: null,
      });
    });

    // 1. Run summary with no filter for Tenant A
    const sumResAll = await app.request("/api/forecasting/summary", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${tokenA}`,
      },
    });
    expect(sumResAll.status).toBe(200);
    const sumDataAll = await sumResAll.json();
    expect(sumDataAll.success).toBe(true);
    // Total Pipeline = 30000 + 50000 + 40000 = 120000
    expect(sumDataAll.data.totalPipelineAmount).toBe(120000);
    // Total Weighted = (30000 * 100%) + (50000 * 60%) + (40000 * 60%) = 30000 + 30000 + 24000 = 84000
    expect(sumDataAll.data.totalWeightedAmount).toBe(84000);
    // Attainment = (30000 / 100000) * 100 = 30%
    expect(sumDataAll.data.attainmentPercentage).toBe(30.0);
    expect(sumDataAll.data.byPeriod.length).toBe(2);

    // 2. Run summary with ?period=2026-05 filter
    const sumResFilter = await app.request(
      "/api/forecasting/summary?period=2026-05",
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${tokenA}`,
        },
      },
    );
    expect(sumResFilter.status).toBe(200);
    const sumDataFilter = await sumResFilter.json();
    expect(sumDataFilter.success).toBe(true);
    // Total Pipeline = 30000 + 50000 = 80000
    expect(sumDataFilter.data.totalPipelineAmount).toBe(80000);
    // Total Weighted = (30000 * 100%) + (50000 * 60%) = 30000 + 30000 = 60000
    expect(sumDataFilter.data.totalWeightedAmount).toBe(60000);
    expect(sumDataFilter.data.byPeriod.length).toBe(1);
    expect(sumDataFilter.data.byPeriod[0].period).toBe("2026-05");

    // 3. Run summary as Tenant B -> returns empty forecast
    const sumResB = await app.request(
      "/api/forecasting/summary?period=2026-05",
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${tokenB}`,
        },
      },
    );
    expect(sumResB.status).toBe(200);
    const sumDataB = await sumResB.json();
    expect(sumDataB.success).toBe(true);
    expect(sumDataB.data.totalPipelineAmount).toBe(0);
    expect(sumDataB.data.totalWeightedAmount).toBe(0);
    expect(sumDataB.data.attainmentPercentage).toBe(0);
    expect(sumDataB.data.byPeriod.length).toBe(0);
  });
});
