import { createSessionToken } from "@crm/auth";
import { calculateAdjustedForecast } from "@crm/core";
import { dbStore, mockDb, withTenant } from "@crm/db";
import { beforeEach, describe, expect, it } from "vitest";
import { createTestApp } from "./_harness";

const app = createTestApp();

describe("Forecast Adjustments & Manager Target Overrides API", () => {
  let tokenTenantA: string;
  let tokenTenantB: string;

  const orgA = "org-tenant-a";
  const orgB = "org-tenant-b";
  const userA = "user-a";
  const userB = "user-b";

  beforeEach(async () => {
    dbStore.clear();

    tokenTenantA = await createSessionToken({
      userId: userA,
      orgId: orgA,
      roleId: "role-a",
      permissionsMask: 7,
    });

    tokenTenantB = await createSessionToken({
      userId: userB,
      orgId: orgB,
      roleId: "role-b",
      permissionsMask: 7,
    });
  });

  describe("Core Unit Tests", () => {
    it("should correctly calculate adjusted forecast summaries for different adjustment types", () => {
      const adjustments = [
        {
          userId: "user-rep1",
          period: "2026-05",
          amount: "150000.00",
          adjustmentType: "override_quota",
        },
        {
          userId: "user-rep1",
          period: "2026-05",
          amount: "50000.00",
          adjustmentType: "override_weighted",
        },
        {
          userId: "user-rep2",
          period: "2026-05",
          amount: "25000.00",
          adjustmentType: "manager_adjustment",
        },
        // Adjustment in a different period (should be ignored)
        {
          userId: "user-rep1",
          period: "2026-06",
          amount: "9999.00",
          adjustmentType: "override_quota",
        },
      ];

      // Test override_quota and override_weighted
      const result1 = calculateAdjustedForecast({
        period: "2026-05",
        baseQuota: 100000,
        baseWeightedAmount: 40000,
        closedWonAmount: 30000,
        adjustments: [adjustments[0], adjustments[1]],
      });

      expect(result1.baseQuota).toBe(100000);
      expect(result1.adjustedQuota).toBe(150000);
      expect(result1.baseWeightedAmount).toBe(40000);
      expect(result1.adjustedWeightedAmount).toBe(50000);
      expect(result1.baseAttainment).toBe(30);
      expect(result1.adjustedAttainment).toBe(20);

      // Test manager_adjustment (additive)
      const result2 = calculateAdjustedForecast({
        period: "2026-05",
        baseQuota: 100000,
        baseWeightedAmount: 40000,
        closedWonAmount: 30000,
        adjustments: [adjustments[2]],
      });

      expect(result2.baseQuota).toBe(100000);
      expect(result2.adjustedQuota).toBe(100000);
      expect(result2.baseWeightedAmount).toBe(40000);
      expect(result2.adjustedWeightedAmount).toBe(65000); // 40000 + 25000
    });
  });

  describe("REST API and RLS Isolation Tests", () => {
    it("should successfully record, retrieve, and calculate adjusted summaries protected by RLS", async () => {
      // 1. Setup mock opportunities and quotas under Tenant A context
      await withTenant(orgA, mockDb, async () => {
        await dbStore.quotas.insert({
          orgId: orgA,
          userId: userA,
          period: "2026-05",
          targetAmount: "100000.00",
        });

        await dbStore.opportunities.insert({
          orgId: orgA,
          ownerId: userA,
          stage: "Closed Won",
          amount: "45000.00",
          closeDate: new Date("2026-05-15"),
        });

        await dbStore.opportunities.insert({
          orgId: orgA,
          ownerId: userA,
          stage: "Proposal",
          amount: "50000.00", // Weighted at 60% standard = 30000.00
          closeDate: new Date("2026-05-20"),
        });
      });

      // 2. Tenant A records a forecast adjustment (quota override)
      const postRes = await app.request("/api/forecasts/adjustments", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenTenantA}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: userA,
          period: "2026-05",
          amount: "150000.00",
          adjustmentType: "override_quota",
          comments: "Adjust rep target upward due to territory expansion",
        }),
      });

      expect(postRes.status).toBe(200);
      const postBody = await postRes.json();
      expect(postBody.success).toBe(true);
      expect(postBody.data.id).toBeDefined();
      expect(postBody.data.amount).toBe("150000.00");

      // 3. Tenant A retrieves the list of adjustments
      const listResA = await app.request("/api/forecasts/adjustments", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${tokenTenantA}`,
        },
      });

      expect(listResA.status).toBe(200);
      const listBodyA = await listResA.json();
      expect(listBodyA.success).toBe(true);
      expect(listBodyA.data.length).toBe(1);
      expect(listBodyA.data[0].amount).toBe("150000.00");

      // 4. Tenant B retrieves list -> returns empty under RLS
      const listResB = await app.request("/api/forecasts/adjustments", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${tokenTenantB}`,
        },
      });

      expect(listResB.status).toBe(200);
      const listBodyB = await listResB.json();
      expect(listBodyB.success).toBe(true);
      expect(listBodyB.data.length).toBe(0);

      // 5. Tenant A retrieves adjusted forecast summary
      const summaryRes = await app.request(
        "/api/forecasts/adjusted-summary?period=2026-05",
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${tokenTenantA}`,
          },
        },
      );

      expect(summaryRes.status).toBe(200);
      const summaryBody = await summaryRes.json();
      expect(summaryBody.success).toBe(true);
      expect(summaryBody.data.baseQuota).toBe(100000);
      expect(summaryBody.data.adjustedQuota).toBe(150000);
      expect(summaryBody.data.baseWeightedAmount).toBe(75000); // 45000 (100%) + 30000 (60%)
      expect(summaryBody.data.adjustedWeightedAmount).toBe(75000); // No weighted adjustments yet
      expect(summaryBody.data.baseAttainment).toBe(45); // 45000 / 100000
      expect(summaryBody.data.adjustedAttainment).toBe(30); // 45000 / 150000
    });
  });
});
