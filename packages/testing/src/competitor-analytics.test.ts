import { createSessionToken } from "@crm/auth";
import { calculateGlobalCompetitorAnalytics } from "@crm/core";
import { dbStore, mockDb, withTenant } from "@crm/db";
import { beforeEach, describe, expect, it } from "vitest";
import { createTestApp } from "./_harness";

const app = createTestApp();

describe("Competitor Win/Loss & Performance Analytics API & Logic Tests", () => {
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

  describe("Core Business Logic", () => {
    it("should accurately compile competitor analytics and win/loss aggregates", () => {
      const opportunities = [
        { id: "opp-1", orgId: orgA, stage: "Closed Won", amount: "10000.00" },
        { id: "opp-2", orgId: orgA, stage: "Closed Lost", amount: "25000.00" },
        { id: "opp-3", orgId: orgA, stage: "Closed Won", amount: "5000.00" },
        {
          id: "opp-4",
          orgId: orgA,
          stage: "Qualification",
          amount: "15000.00",
        },
      ];

      const competitors = [
        // Competitor A - Won against them on opp-1
        {
          id: "c-1",
          orgId: orgA,
          opportunityId: "opp-1",
          name: "Competitor A",
          strength: "Fast support",
          weakness: "High price",
          winLossStatus: "Lost",
        },
        // Competitor A - Lost to them on opp-2
        {
          id: "c-2",
          orgId: orgA,
          opportunityId: "opp-2",
          name: "competitor a ", // Case-insensitive casing & whitespace normalisation
          strength: "Strong API",
          weakness: "Expensive",
          winLossStatus: "Won",
        },
        // Competitor A - Won against them on opp-3
        {
          id: "c-3",
          orgId: orgA,
          opportunityId: "opp-3",
          name: "Competitor A",
          strength: "Fast support", // Duplicate strength should be unique'd
          weakness: "Complex setup",
          winLossStatus: "Lost",
        },
        // Competitor A - Pending on opp-4
        {
          id: "c-4",
          orgId: orgA,
          opportunityId: "opp-4",
          name: "Competitor A",
          strength: null,
          weakness: null,
          winLossStatus: "Pending",
        },
      ];

      const report = calculateGlobalCompetitorAnalytics({
        competitors,
        opportunities,
      });

      expect(report.length).toBe(1);
      const metrics = report[0];
      expect(metrics.name).toBe("Competitor A");
      expect(metrics.totalCompetitions).toBe(4);
      expect(metrics.wonCount).toBe(2); // opp-1 & opp-3 won
      expect(metrics.lostCount).toBe(1); // opp-2 lost
      expect(metrics.winRate).toBe(66.67); // 2 wins out of 3 decided (66.67%)
      expect(metrics.totalValue).toBe("55000.00"); // 10000 + 25000 + 5000 + 15000
      expect(metrics.wonValue).toBe("15000.00"); // 10000 + 5000 won opportunity values
      expect(metrics.strengths).toContain("Fast support");
      expect(metrics.strengths).toContain("Strong API");
      expect(metrics.strengths.length).toBe(2); // unique'd
      expect(metrics.weaknesses).toContain("High price");
      expect(metrics.weaknesses).toContain("Expensive");
      expect(metrics.weaknesses).toContain("Complex setup");
      expect(metrics.weaknesses.length).toBe(3);
    });

    it("should handle empty or undecided competitor entries gracefully", () => {
      const opportunities = [
        { id: "opp-1", orgId: orgA, stage: "Prospecting", amount: "5000.00" },
      ];
      const competitors = [
        {
          id: "c-1",
          orgId: orgA,
          opportunityId: "opp-1",
          name: "Competitor B",
          strength: null,
          weakness: null,
          winLossStatus: "Pending",
        },
      ];

      const report = calculateGlobalCompetitorAnalytics({
        competitors,
        opportunities,
      });

      expect(report.length).toBe(1);
      const metrics = report[0];
      expect(metrics.name).toBe("Competitor B");
      expect(metrics.totalCompetitions).toBe(1);
      expect(metrics.wonCount).toBe(0);
      expect(metrics.lostCount).toBe(0);
      expect(metrics.winRate).toBe(0.0);
      expect(metrics.totalValue).toBe("5000.00");
      expect(metrics.wonValue).toBe("0.00");
      expect(metrics.strengths).toEqual([]);
      expect(metrics.weaknesses).toEqual([]);
    });
  });

  describe("REST API Endpoints & RLS Tenancy Isolation", () => {
    it("should correctly fetch tenant-isolated competitor report details", async () => {
      // 1. Setup Tenant A DB records
      await withTenant(orgA, mockDb, async () => {
        const opp1 = await dbStore.opportunities.insert({
          orgId: orgA,
          ownerId: "user-a",
          accountId: "account-a",
          name: "Deal A1",
          stage: "Closed Won",
          amount: "12000.00",
          closeDate: new Date(),
          custom: null,
        });

        const opp2 = await dbStore.opportunities.insert({
          orgId: orgA,
          ownerId: "user-a",
          accountId: "account-a",
          name: "Deal A2",
          stage: "Closed Lost",
          amount: "8000.00",
          closeDate: new Date(),
          custom: null,
        });

        await dbStore.opportunityCompetitors.insert({
          orgId: orgA,
          opportunityId: opp1.id,
          name: "Google Competitor",
          strength: "Deep pockets",
          weakness: "Complex interface",
          winLossStatus: "Lost",
        });

        await dbStore.opportunityCompetitors.insert({
          orgId: orgA,
          opportunityId: opp2.id,
          name: "Google Competitor",
          strength: "Brand visibility",
          weakness: "Expensive support",
          winLossStatus: "Won",
        });
      });

      // 2. Setup Tenant B DB records
      await withTenant(orgB, mockDb, async () => {
        const oppB = await dbStore.opportunities.insert({
          orgId: orgB,
          ownerId: "user-b",
          accountId: "account-b",
          name: "Deal B1",
          stage: "Closed Won",
          amount: "40000.00",
          closeDate: new Date(),
          custom: null,
        });

        await dbStore.opportunityCompetitors.insert({
          orgId: orgB,
          opportunityId: oppB.id,
          name: "Amazon Competitor",
          strength: "AWS ecosystem",
          weakness: "High pricing",
          winLossStatus: "Lost",
        });
      });

      // 3. GET /api/reports/competitor-analytics as Tenant A
      const resA = await app.request("/api/reports/competitor-analytics", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${tokenTenantA}`,
        },
      });

      expect(resA.status).toBe(200);
      const bodyA = await resA.json();
      expect(bodyA.success).toBe(true);
      expect(bodyA.data.length).toBe(1);

      const metricsA = bodyA.data[0];
      expect(metricsA.name).toBe("Google Competitor");
      expect(metricsA.totalCompetitions).toBe(2);
      expect(metricsA.wonCount).toBe(1);
      expect(metricsA.lostCount).toBe(1);
      expect(metricsA.winRate).toBe(50.0);
      expect(metricsA.totalValue).toBe("20000.00");
      expect(metricsA.wonValue).toBe("12000.00");
      expect(metricsA.strengths).toContain("Deep pockets");
      expect(metricsA.strengths).toContain("Brand visibility");
      expect(metricsA.weaknesses).toContain("Complex interface");
      expect(metricsA.weaknesses).toContain("Expensive support");

      // 4. GET /api/reports/competitor-analytics as Tenant B
      const resB = await app.request("/api/reports/competitor-analytics", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${tokenTenantB}`,
        },
      });

      expect(resB.status).toBe(200);
      const bodyB = await resB.json();
      expect(bodyB.success).toBe(true);
      expect(bodyB.data.length).toBe(1);

      const metricsB = bodyB.data[0];
      expect(metricsB.name).toBe("Amazon Competitor");
      expect(metricsB.totalCompetitions).toBe(1);
      expect(metricsB.wonCount).toBe(1);
      expect(metricsB.lostCount).toBe(0);
      expect(metricsB.winRate).toBe(100.0);
      expect(metricsB.totalValue).toBe("40000.00");
      expect(metricsB.wonValue).toBe("40000.00");
    });
  });
});
