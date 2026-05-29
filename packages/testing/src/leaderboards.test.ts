import { createSessionToken } from "@crm/auth";
import { calculateSalesLeaderboard, isDateInPeriod } from "@crm/core";
import { dbStore, mockDb, store, withTenant } from "@crm/db";
import { beforeEach, describe, expect, it } from "vitest";
import app from "../../../apps/api/src/index";

describe("Sales Leaderboards & Quota Attainment Engine", () => {
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
    it("should correctly evaluate isDateInPeriod for monthly and quarterly periods", () => {
      const date = new Date("2026-05-15T10:00:00.000Z");

      // Monthly matching
      expect(isDateInPeriod(date, "2026-05")).toBe(true);
      expect(isDateInPeriod(date, "2026-06")).toBe(false);
      expect(isDateInPeriod(date, "2025-05")).toBe(false);

      // Quarterly matching
      expect(isDateInPeriod(date, "2026-Q2")).toBe(true);
      expect(isDateInPeriod(date, "2026-Q1")).toBe(false);
      expect(isDateInPeriod(date, "2026-Q3")).toBe(false);
      expect(isDateInPeriod(date, "2025-Q2")).toBe(false);

      // Edge Cases
      expect(isDateInPeriod(new Date("invalid"), "2026-05")).toBe(false);
    });

    it("should correctly compile ranked leaderboard with quotas and attainment", () => {
      const users = [
        { userId: "rep1", userName: "Alice" },
        { userId: "rep2", userName: "Bob" },
        { userId: "rep3", userName: "Charlie" },
      ];

      const opportunities = [
        {
          id: "opp1",
          ownerId: "rep1",
          stage: "Closed Won",
          amount: "50000.00",
          closeDate: new Date("2026-05-10"),
        },
        {
          id: "opp2",
          ownerId: "rep1",
          stage: "Closed Won",
          amount: "20000.00",
          closeDate: new Date("2026-05-20"),
        },
        {
          id: "opp3",
          ownerId: "rep2",
          stage: "Closed Won",
          amount: "100000.00",
          closeDate: new Date("2026-05-15"),
        },
        {
          id: "opp4",
          ownerId: "rep3",
          stage: "Closed Won",
          amount: "30000.00",
          closeDate: new Date("2026-05-01"),
        },
        // Opp closed in different stage (should be ignored)
        {
          id: "opp5",
          ownerId: "rep3",
          stage: "Proposal",
          amount: "40000.00",
          closeDate: new Date("2026-05-02"),
        },
        // Opp closed in different month (should be ignored)
        {
          id: "opp6",
          ownerId: "rep2",
          stage: "Closed Won",
          amount: "50000.00",
          closeDate: new Date("2026-06-01"),
        },
      ];

      const quotas = [
        { userId: "rep1", period: "2026-05", targetAmount: "100000.00" }, // quota 100k, won 70k -> 70% attainment
        { userId: "rep2", period: "2026-05", targetAmount: "200000.00" }, // quota 200k, won 100k -> 50% attainment
        { userId: "rep3", period: "2026-05", targetAmount: "30000.00" }, // quota 30k, won 30k -> 100% attainment
      ];

      const result = calculateSalesLeaderboard({
        period: "2026-05",
        users,
        opportunities,
        quotas,
      });

      expect(result.period).toBe("2026-05");
      expect(result.leaderboard.length).toBe(3);

      // Charlie should be rank 1 (100% attainment)
      expect(result.leaderboard[0].userId).toBe("rep3");
      expect(result.leaderboard[0].userName).toBe("Charlie");
      expect(result.leaderboard[0].totalClosedWon).toBe(30000);
      expect(result.leaderboard[0].attainmentPercentage).toBe(100);
      expect(result.leaderboard[0].rank).toBe(1);

      // Alice should be rank 2 (70% attainment)
      expect(result.leaderboard[1].userId).toBe("rep1");
      expect(result.leaderboard[1].userName).toBe("Alice");
      expect(result.leaderboard[1].totalClosedWon).toBe(70000);
      expect(result.leaderboard[1].attainmentPercentage).toBe(70);
      expect(result.leaderboard[1].rank).toBe(2);

      // Bob should be rank 3 (50% attainment)
      expect(result.leaderboard[2].userId).toBe("rep2");
      expect(result.leaderboard[2].userName).toBe("Bob");
      expect(result.leaderboard[2].totalClosedWon).toBe(100000);
      expect(result.leaderboard[2].attainmentPercentage).toBe(50);
      expect(result.leaderboard[2].rank).toBe(3);
    });
  });

  describe("API Endpoint Routes & RLS Tenancy Isolation", () => {
    it("should allow querying sales leaderboard under strict tenant isolation", async () => {
      // 1. Seed users/memberships globally in the memory store
      const userRepA1 = "rep-a1";
      const userRepA2 = "rep-a2";
      const userRepB1 = "rep-b1";

      await dbStore.users.insert({
        id: userRepA1,
        email: "alice@tenanta.com",
        passwordHash: "x",
        status: "active",
      });
      await dbStore.users.insert({
        id: userRepA2,
        email: "bob@tenanta.com",
        passwordHash: "x",
        status: "active",
      });
      await dbStore.users.insert({
        id: userRepB1,
        email: "charlie@tenantb.com",
        passwordHash: "x",
        status: "active",
      });

      await withTenant(orgA, mockDb, async () => {
        await dbStore.memberships.insert({
          orgId: orgA,
          userId: userRepA1,
          roleId: "role-rep",
        });
        await dbStore.memberships.insert({
          orgId: orgA,
          userId: userRepA2,
          roleId: "role-rep",
        });

        // Opportunities for Tenant A
        await dbStore.opportunities.insert({
          orgId: orgA,
          ownerId: userRepA1,
          name: "A1 Big Deal",
          stage: "Closed Won",
          amount: "60000.00",
          closeDate: new Date("2026-05-15"),
          custom: null,
        });

        await dbStore.opportunities.insert({
          orgId: orgA,
          ownerId: userRepA2,
          name: "A2 Deal",
          stage: "Closed Won",
          amount: "80000.00",
          closeDate: new Date("2026-05-15"),
          custom: null,
        });

        // Quotas for Tenant A
        await dbStore.quotas.insert({
          orgId: orgA,
          userId: userRepA1,
          period: "2026-Q2",
          targetAmount: "100000.00", // 60k won -> 60%
        });

        await dbStore.quotas.insert({
          orgId: orgA,
          userId: userRepA2,
          period: "2026-Q2",
          targetAmount: "200000.00", // 80k won -> 40%
        });
      });

      await withTenant(orgB, mockDb, async () => {
        await dbStore.memberships.insert({
          orgId: orgB,
          userId: userRepB1,
          roleId: "role-rep",
        });

        // Opportunities for Tenant B
        await dbStore.opportunities.insert({
          orgId: orgB,
          ownerId: userRepB1,
          name: "B1 Deal",
          stage: "Closed Won",
          amount: "90000.00",
          closeDate: new Date("2026-05-15"),
          custom: null,
        });

        // Quotas for Tenant B
        await dbStore.quotas.insert({
          orgId: orgB,
          userId: userRepB1,
          period: "2026-Q2",
          targetAmount: "100000.00", // 90k won -> 90%
        });
      });

      // 2. Tenant A queries their leaderboard for 2026-Q2
      const resA = await app.request("/api/leaderboards?period=2026-Q2", {
        method: "GET",
        headers: { Authorization: `Bearer ${tokenTenantA}` },
      });
      expect(resA.status).toBe(200);
      const bodyA = await resA.json();
      expect(bodyA.success).toBe(true);
      expect(bodyA.period).toBe("2026-Q2");
      expect(bodyA.leaderboard.length).toBe(2);

      // rep-a1 (alice) should be rank 1 (60% attainment)
      expect(bodyA.leaderboard[0].userId).toBe(userRepA1);
      expect(bodyA.leaderboard[0].userName).toBe("alice");
      expect(bodyA.leaderboard[0].totalClosedWon).toBe(60000);
      expect(bodyA.leaderboard[0].quotaTarget).toBe(100000);
      expect(bodyA.leaderboard[0].attainmentPercentage).toBe(60);
      expect(bodyA.leaderboard[0].rank).toBe(1);

      // rep-a2 (bob) should be rank 2 (40% attainment)
      expect(bodyA.leaderboard[1].userId).toBe(userRepA2);
      expect(bodyA.leaderboard[1].userName).toBe("bob");
      expect(bodyA.leaderboard[1].totalClosedWon).toBe(80000);
      expect(bodyA.leaderboard[1].quotaTarget).toBe(200000);
      expect(bodyA.leaderboard[1].attainmentPercentage).toBe(40);
      expect(bodyA.leaderboard[1].rank).toBe(2);

      // 3. Tenant B queries their leaderboard for 2026-Q2 (verifying RLS)
      const resB = await app.request("/api/leaderboards?period=2026-Q2", {
        method: "GET",
        headers: { Authorization: `Bearer ${tokenTenantB}` },
      });
      expect(resB.status).toBe(200);
      const bodyB = await resB.json();
      expect(bodyB.success).toBe(true);
      expect(bodyB.period).toBe("2026-Q2");
      expect(bodyB.leaderboard.length).toBe(1);

      // rep-b1 (charlie) should be rank 1 (90% attainment)
      expect(bodyB.leaderboard[0].userId).toBe(userRepB1);
      expect(bodyB.leaderboard[0].userName).toBe("charlie");
      expect(bodyB.leaderboard[0].totalClosedWon).toBe(90000);
      expect(bodyB.leaderboard[0].quotaTarget).toBe(100000);
      expect(bodyB.leaderboard[0].attainmentPercentage).toBe(90);
      expect(bodyB.leaderboard[0].rank).toBe(1);
    });
  });
});
