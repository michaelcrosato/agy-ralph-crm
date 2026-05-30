import { createSessionToken } from "@crm/auth";
import { dbStore, mockDb, withTenant } from "@crm/db";
import {
  compileForecastCategorySummary,
  type ForecastCategorySummary,
} from "@crm/forecasting";
import { beforeEach, describe, expect, it } from "vitest";
import app from "../../../apps/api/src/index";

describe("Opportunity Forecast Category Mapping & Category-Based Forecasting Engine", () => {
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
    it("should correctly compile category forecast summaries under default and custom mappings", () => {
      const opportunities = [
        {
          id: "opp1",
          stage: "Prospecting",
          amount: "10000.00",
          closeDate: new Date("2026-05-10"),
        },
        {
          id: "opp2",
          stage: "Proposal",
          amount: "50000.00", // standard 60% probability = 30000 weighted
          closeDate: new Date("2026-05-15"),
        },
        {
          id: "opp3",
          stage: "Negotiation",
          amount: "100000.00", // standard 80% probability = 80000 weighted
          closeDate: new Date("2026-05-20"),
        },
        {
          id: "opp4",
          stage: "Closed Won",
          amount: "20000.00", // standard 100% probability = 20000 weighted
          closeDate: new Date("2026-05-25"),
        },
      ];

      // 1. Compile with empty custom mappings (should fall back to defaults)
      const defaultSummary = compileForecastCategorySummary({
        opportunities,
        stageMappings: {},
      });

      const pipelineGroup = defaultSummary.find(
        (s) => s.category === "Pipeline",
      );
      const bestCaseGroup = defaultSummary.find(
        (s) => s.category === "Best Case",
      );
      const commitGroup = defaultSummary.find((s) => s.category === "Commit");
      const closedGroup = defaultSummary.find((s) => s.category === "Closed");
      const omittedGroup = defaultSummary.find((s) => s.category === "Omitted");

      expect(pipelineGroup?.actualAmount).toBe(10000);
      expect(pipelineGroup?.weightedAmount).toBe(1000); // 10%
      expect(pipelineGroup?.count).toBe(1);

      expect(bestCaseGroup?.actualAmount).toBe(50000);
      expect(bestCaseGroup?.weightedAmount).toBe(30000); // 60%
      expect(bestCaseGroup?.count).toBe(1);

      expect(commitGroup?.actualAmount).toBe(100000);
      expect(commitGroup?.weightedAmount).toBe(80000); // 80%
      expect(commitGroup?.count).toBe(1);

      expect(closedGroup?.actualAmount).toBe(20000);
      expect(closedGroup?.weightedAmount).toBe(20000); // 100%
      expect(closedGroup?.count).toBe(1);

      expect(omittedGroup?.count).toBe(0);

      // 2. Compile with custom stage mappings (override Negotiation to Best Case)
      const customMappings = {
        Negotiation: "Best Case",
      };

      const customSummary = compileForecastCategorySummary({
        opportunities,
        stageMappings: customMappings,
      });

      const bestCaseCustom = customSummary.find(
        (s) => s.category === "Best Case",
      );
      const commitCustom = customSummary.find((s) => s.category === "Commit");

      // Best Case actual should now be 50000 + 100000 = 150000
      expect(bestCaseCustom?.actualAmount).toBe(150000);
      expect(bestCaseCustom?.weightedAmount).toBe(110000); // 30000 + 80000
      expect(bestCaseCustom?.count).toBe(2);

      // Commit group should now be empty
      expect(commitCustom?.count).toBe(0);
    });
  });

  describe("REST API and RLS Isolation Tests", () => {
    it("should manage stage-to-category mappings and return summaries strictly partitioned by tenant", async () => {
      // 1. Seed Tenant A opportunities
      await withTenant(orgA, mockDb, async () => {
        await dbStore.opportunities.insert({
          orgId: orgA,
          ownerId: userA,
          stage: "Prospecting",
          amount: "10000.00",
          closeDate: new Date("2026-05-10"),
        });

        await dbStore.opportunities.insert({
          orgId: orgA,
          ownerId: userA,
          stage: "Proposal",
          amount: "40000.00",
          closeDate: new Date("2026-05-15"),
        });
      });

      // 2. Seed Tenant B opportunities
      await withTenant(orgB, mockDb, async () => {
        await dbStore.opportunities.insert({
          orgId: orgB,
          ownerId: userB,
          stage: "Negotiation",
          amount: "80000.00",
          closeDate: new Date("2026-05-20"),
        });
      });

      // 3. Save a custom stage forecast mapping for Tenant A via REST API
      const postMappingRes = await app.request(
        "/api/forecasting/stage-mappings",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${tokenTenantA}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            stage: "Proposal",
            forecastCategory: "Commit", // Override standard "Best Case" mapping to "Commit"
          }),
        },
      );

      expect(postMappingRes.status).toBe(200);
      const postMappingBody = await postMappingRes.json();
      expect(postMappingBody.success).toBe(true);
      expect(postMappingBody.data.stage).toBe("Proposal");
      expect(postMappingBody.data.forecastCategory).toBe("Commit");

      // 4. Retrieve mappings for Tenant A -> should show the custom mapping
      const getMappingsARes = await app.request(
        "/api/forecasting/stage-mappings",
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${tokenTenantA}`,
          },
        },
      );

      expect(getMappingsARes.status).toBe(200);
      const getMappingsABody = await getMappingsARes.json();
      expect(getMappingsABody.success).toBe(true);
      expect(getMappingsABody.data.length).toBe(1);
      expect(getMappingsABody.data[0].stage).toBe("Proposal");
      expect(getMappingsABody.data[0].forecastCategory).toBe("Commit");

      // 5. Retrieve mappings for Tenant B -> should be empty (RLS)
      const getMappingsBRes = await app.request(
        "/api/forecasting/stage-mappings",
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${tokenTenantB}`,
          },
        },
      );

      expect(getMappingsBRes.status).toBe(200);
      const getMappingsBBody = await getMappingsBRes.json();
      expect(getMappingsBBody.success).toBe(true);
      expect(getMappingsBBody.data.length).toBe(0);

      // 6. Retrieve forecast category summary for Tenant A
      const summaryARes = await app.request(
        "/api/forecasting/categories-summary?period=2026-05",
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${tokenTenantA}`,
          },
        },
      );

      expect(summaryARes.status).toBe(200);
      const summaryABody = await summaryARes.json();
      expect(summaryABody.success).toBe(true);

      const commitGroupA = summaryABody.data.find(
        (s: ForecastCategorySummary) => s.category === "Commit",
      );
      const pipelineGroupA = summaryABody.data.find(
        (s: ForecastCategorySummary) => s.category === "Pipeline",
      );
      const bestCaseGroupA = summaryABody.data.find(
        (s: ForecastCategorySummary) => s.category === "Best Case",
      );

      // Tenant A Proposal (40000) was mapped to Commit
      expect(commitGroupA?.actualAmount).toBe(40000);
      expect(commitGroupA?.weightedAmount).toBe(24000); // 40000 * 60% standard probability
      expect(commitGroupA?.count).toBe(1);

      // Tenant A Prospecting (10000) mapped to standard Pipeline
      expect(pipelineGroupA?.actualAmount).toBe(10000);
      expect(pipelineGroupA?.weightedAmount).toBe(1000); // 10000 * 10% standard probability
      expect(pipelineGroupA?.count).toBe(1);

      // Best Case should be empty because we mapped Proposal to Commit
      expect(bestCaseGroupA?.count).toBe(0);

      // Tenant B's opportunities (80000 in Negotiation) must NOT leak into Tenant A's summary
      const tenantBLeak = summaryABody.data.find(
        (s: ForecastCategorySummary) => s.actualAmount === 80000,
      );
      expect(tenantBLeak).toBeUndefined();

      // 7. Retrieve forecast category summary for Tenant B
      const summaryBRes = await app.request(
        "/api/forecasting/categories-summary?period=2026-05",
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${tokenTenantB}`,
          },
        },
      );

      expect(summaryBRes.status).toBe(200);
      const summaryBBody = await summaryBRes.json();
      expect(summaryBBody.success).toBe(true);

      const commitGroupB = summaryBBody.data.find(
        (s: ForecastCategorySummary) => s.category === "Commit",
      );

      // Tenant B's 80000 opportunity in Negotiation maps to standard Commit group
      expect(commitGroupB?.actualAmount).toBe(80000);
      expect(commitGroupB?.weightedAmount).toBe(64000); // 80000 * 80% standard probability
      expect(commitGroupB?.count).toBe(1);
    });
  });
});
