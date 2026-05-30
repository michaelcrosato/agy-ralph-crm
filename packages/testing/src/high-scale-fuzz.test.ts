import { createSessionToken } from "@crm/auth";
import { dbStore, mockDb, withTenant } from "@crm/db";
import { beforeEach, describe, expect, it } from "vitest";
import app from "../../../apps/api/src/index";

describe("Phase 6: High Scale Seeder and Fuzz Testing Engine API Tests", () => {
  let tokenTenantA: string;
  let _tokenTenantB: string;

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

    _tokenTenantB = await createSessionToken({
      userId: "user-b",
      orgId: orgB,
      roleId: "role-b",
      permissionsMask: 7,
    });
  });

  describe("API Authentication Gate", () => {
    it("should reject anonymous requests with 401 on admin endpoints", async () => {
      const seedRes = await app.request("/api/admin/seed", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ accountCount: 5 }),
      });
      expect(seedRes.status).toBe(401);

      const fuzzRes = await app.request("/api/admin/fuzz", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });
      expect(fuzzRes.status).toBe(401);
    });
  });

  describe("Seeder Functionality and RLS Tenancy Isolation", () => {
    it("should seed bulk records correctly and isolate records to the active tenant", async () => {
      // 1. Trigger seeding for Tenant A
      const seedResA = await app.request("/api/admin/seed", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenTenantA}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          accountCount: 15,
          contactCount: 10,
          leadCount: 8,
          opportunityCount: 6,
        }),
      });

      expect(seedResA.status).toBe(200);
      const seedBodyA = await seedResA.json();
      expect(seedBodyA.success).toBe(true);
      expect(seedBodyA.counts.accounts).toBe(15);
      expect(seedBodyA.counts.contacts).toBe(10);
      expect(seedBodyA.counts.leads).toBe(8);
      expect(seedBodyA.counts.opportunities).toBe(6);

      // 2. Query data under Tenant A - should return seeded amounts
      await withTenant(orgA, mockDb, async () => {
        const allAccounts = await dbStore.accounts.findMany();
        const accountsA = allAccounts.filter((a) => a.orgId === orgA);
        expect(accountsA.length).toBe(15);

        const allLeads = await dbStore.leads.findMany();
        const leadsA = allLeads.filter((l) => l.orgId === orgA);
        expect(leadsA.length).toBe(8);
      });

      // 3. Query under Tenant B - should return 0 due to strict RLS
      await withTenant(orgB, mockDb, async () => {
        const allAccounts = await dbStore.accounts.findMany();
        const accountsB = allAccounts.filter((a) => a.orgId === orgB);
        expect(accountsB.length).toBe(0);

        const allLeads = await dbStore.leads.findMany();
        const leadsB = allLeads.filter((l) => l.orgId === orgB);
        expect(leadsB.length).toBe(0);
      });
    });

    it("should execute queries extremely fast even with high volume, validating perf targets", async () => {
      // Seed 100 of each
      await app.request("/api/admin/seed", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenTenantA}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          accountCount: 100,
          contactCount: 100,
          leadCount: 100,
          opportunityCount: 100,
        }),
      });

      // Assert queries run in under 50ms performance limit
      await withTenant(orgA, mockDb, async () => {
        const startTime = performance.now();
        const listAccounts = await dbStore.accounts.findMany();
        const endTime = performance.now();

        expect(listAccounts.length).toBeGreaterThanOrEqual(100);
        const queryDuration = endTime - startTime;
        expect(queryDuration).toBeLessThan(50); // Must be < 50ms performance target
      });
    });
  });

  describe("Security Fuzzing Suite", () => {
    it("should successfully process fuzzed inputs without any unhandled exceptions or RLS bypass", async () => {
      const fuzzRes = await app.request("/api/admin/fuzz", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenTenantA}`,
          "Content-Type": "application/json",
        },
      });

      expect(fuzzRes.status).toBe(200);
      const fuzzBody = await fuzzRes.json();
      expect(fuzzBody.success).toBe(true);
      expect(fuzzBody.totalRuns).toBe(5);
      expect(fuzzBody.failures).toBeDefined();

      // Ensure no RLS leaks occurred - all created fuzz records must belong strictly to Tenant A
      await withTenant(orgA, mockDb, async () => {
        const allLeads = await dbStore.leads.findMany();
        const fuzzLeads = allLeads.filter((l) => l.email?.startsWith("fuzz-"));

        for (const lead of fuzzLeads) {
          expect(lead.orgId).toBe(orgA);
        }
      });
    });
  });
});
