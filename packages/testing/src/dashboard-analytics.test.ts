import { createSessionToken } from "@crm/auth";
import { dbStore, mockDb, pgDb, withTenant } from "@crm/db";
import { sql } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { createTestApp } from "./_harness";

const app = createTestApp();

import { getTestPgContainer, isDockerAvailable } from "./pg-container";

const backends = [
  {
    name: "mock",
    setup: async () => {
      process.env.DB_DRIVER = "mock";
    },
  },
];

if (isDockerAvailable()) {
  backends.push({
    name: "postgres",
    setup: async () => {
      const { connectionString } = await getTestPgContainer();
      process.env.DB_DRIVER = "pg";
      process.env.DB_URL = connectionString;
    },
  });
}

describe.each(
  backends,
)("Dashboard Analytics REST API on $name backend (spec 033)", ({ setup }) => {
  let tokenTenantA: string;
  let tokenTenantB: string;

  const orgA = "org-analytics-a";
  const orgB = "org-analytics-b";
  const userA = "user-analytics-a";
  const userB = "user-analytics-b";

  beforeEach(async () => {
    await setup();
    await dbStore.clear();

    // Seed PostgreSQL constraints
    if (process.env.DB_DRIVER === "pg") {
      await pgDb.execute(
        sql.raw(
          `INSERT INTO "organizations" ("id", "name", "status") VALUES ('${orgA}', 'Tenant A', 'active'), ('${orgB}', 'Tenant B', 'active') ON CONFLICT DO NOTHING`,
        ),
      );
      await pgDb.execute(
        sql.raw(
          `INSERT INTO "users" ("id", "email", "password_hash", "status") VALUES 
              ('${userA}', 'user-a@analytics.com', 'hash', 'active'),
              ('${userB}', 'user-b@analytics.com', 'hash', 'active')
            ON CONFLICT DO NOTHING`,
        ),
      );
    }

    // Generate JWT tokens
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
  }, 60000);

  it("should reject non-authenticated API requests with 401", async () => {
    const res = await app.request("/api/dashboard/analytics", {
      method: "GET",
    });
    expect(res.status).toBe(401);
  });

  it("should return correct aggregated lead metrics and enforce strict tenant RLS isolation", async () => {
    const db = process.env.DB_DRIVER === "pg" ? pgDb : mockDb;

    // Seed Tenant A data
    await withTenant(orgA, db, async () => {
      // 1. Seed Leads
      const lead1 = await dbStore.leads.insert({
        orgId: orgA,
        ownerId: userA,
        status: "New",
        email: "lead1@example.com",
        company: "Company One",
      });

      const lead2 = await dbStore.leads.insert({
        orgId: orgA,
        ownerId: userA,
        status: "Converted",
        email: "lead2@example.com",
        company: "Company Two",
      });

      const lead3 = await dbStore.leads.insert({
        orgId: orgA,
        ownerId: userB,
        status: "Converted",
        email: "lead3@example.com",
        company: "Company Three",
      });

      // 2. Seed Audit Logs to calculate average velocity
      // Lead 2: 2 days velocity
      await dbStore.auditLogs.insert({
        orgId: orgA,
        recordId: lead2.id,
        recordType: "Lead",
        action: "create",
        userId: userA,
        createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
      });
      await dbStore.auditLogs.insert({
        orgId: orgA,
        recordId: lead2.id,
        recordType: "Lead",
        action: "update",
        userId: userA,
        changes: { status: { before: "New", after: "Converted" } },
        createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
      });

      // Lead 3: 4 days velocity
      await dbStore.auditLogs.insert({
        orgId: orgA,
        recordId: lead3.id,
        recordType: "Lead",
        action: "create",
        userId: userB,
        createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), // 10 days ago
      });
      await dbStore.auditLogs.insert({
        orgId: orgA,
        recordId: lead3.id,
        recordType: "Lead",
        action: "update",
        userId: userB,
        changes: { status: { before: "New", after: "Converted" } },
        createdAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000), // 6 days ago
      });

      // 3. Seed SLA target + tracker with Breach status
      const target = await dbStore.leadSlaTargets.insert({
        orgId: orgA,
        maxResponseTimeMinutes: 30,
      });

      await dbStore.leadSlaTrackers.insert({
        orgId: orgA,
        leadId: lead1.id,
        targetId: target.id,
        status: "Breached",
      });
    });

    // 4. Test analytics request for Tenant A
    const resA = await app.request("/api/dashboard/analytics", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${tokenTenantA}`,
      },
    });

    expect(resA.status).toBe(200);
    const jsonA = await resA.json();
    expect(jsonA.success).toBe(true);

    const dataA = jsonA.data;
    expect(dataA.leadCount).toBe(3);
    expect(dataA.conversionRate).toBeCloseTo(66.67, 1);
    expect(dataA.avgVelocityDays).toBeCloseTo(3.0, 1);
    expect(dataA.slaBreachCount).toBe(1);

    // Verify grouping byOwner
    expect(dataA.byOwner.length).toBe(2);
    const ownerAData = dataA.byOwner.find((o: any) => o.ownerId === userA);
    const ownerBData = dataA.byOwner.find((o: any) => o.ownerId === userB);
    expect(ownerAData).toBeDefined();
    expect(ownerAData.leadCount).toBe(2);
    expect(ownerBData).toBeDefined();
    expect(ownerBData.leadCount).toBe(1);

    // 5. Test analytics request for Tenant B (should be completely empty/isolated)
    const resB = await app.request("/api/dashboard/analytics", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${tokenTenantB}`,
      },
    });

    expect(resB.status).toBe(200);
    const jsonB = await resB.json();
    expect(jsonB.success).toBe(true);

    const dataB = jsonB.data;
    expect(dataB.leadCount).toBe(0);
    expect(dataB.conversionRate).toBe(0);
    expect(dataB.avgVelocityDays).toBe(0);
    expect(dataB.slaBreachCount).toBe(0);
    expect(dataB.byOwner.length).toBe(0);
  });
});
