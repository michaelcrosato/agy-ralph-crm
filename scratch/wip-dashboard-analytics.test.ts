import { createSessionToken } from "@crm/auth";
import { dbStore, mockDb, withTenant } from "@crm/db";
import { describe, expect, it } from "vitest";
import app from "../../../apps/api/src/index";

describe("Dashboard Lead Analytics API Tests (TICKET004)", () => {
  it("should enforce strict organization RLS isolation and return 401/error without valid auth", async () => {
    // Attempt request without authorization header
    const res = await app.request("/api/dashboard/analytics", {
      method: "GET",
    });
    expect(res.status).toBe(401);
  });

  it("should aggregate and return correct lead telemetry for the active tenant", async () => {
    const orgId = "org-tenant-a";
    const userId = "user-a";

    // Insert mock seed leads and SLA trackers under Tenant A organization
    await withTenant(orgId, mockDb, async () => {
      // Clean first
      const leads = await dbStore.leads.findMany();
      for (const l of leads) {
        if (l.orgId === orgId) {
          await dbStore.leads.delete(l.id);
        }
      }
      const trackers = await dbStore.leadSlaTrackers.findMany();
      for (const t of trackers) {
        if (t.orgId === orgId) {
          await dbStore.leadSlaTrackers.delete(t.id);
        }
      }

      // Lead A1: New, non-converted, non-fuzzed
      await dbStore.leads.insert({
        orgId,
        ownerId: userId,
        status: "New",
        email: "test1@example.com",
        company: "Company A",
      });

      // Lead A2: Converted, non-fuzzed
      const leadA2 = await dbStore.leads.insert({
        orgId,
        ownerId: userId,
        status: "Converted",
        email: "test2@example.com",
        company: "Company B",
        convertedAccountId: "00000000-0000-0000-0000-000000000001",
        convertedContactId: "00000000-0000-0000-0000-000000000002",
      });

      // Lead A3: Fuzzed (missing email)
      await dbStore.leads.insert({
        orgId,
        ownerId: userId,
        status: "New",
        email: "",
        company: "Company C",
      });

      // SLA Target
      const target = await dbStore.leadSlaTargets.insert({
        orgId,
        maxResponseTimeMinutes: 60,
        isActive: 1,
      });

      // SLA tracker: Met, conversion velocity 30 mins
      await dbStore.leadSlaTrackers.insert({
        orgId,
        leadId: leadA2.id,
        targetId: target.id,
        status: "Met",
        createdAt: new Date(Date.now() - 60 * 60 * 1000),
        respondedAt: new Date(Date.now() - 30 * 60 * 1000),
        responseTimeMinutes: 30,
      });
    });

    // Create session token for Tenant A
    const token = await createSessionToken({
      userId,
      orgId,
      roleId: "role-a",
      permissionsMask: 7,
    });

    const res = await app.request("/api/dashboard/analytics", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.totalLeads).toBe(3);
    expect(body.data.statusCounts.New).toBe(2);
    expect(body.data.statusCounts.Converted).toBe(1);
    expect(body.data.fuzzedCount).toBe(1); // Lead A3 is fuzzed
    expect(body.data.conversionRate).toBeCloseTo(1 / 3, 2);
    expect(body.data.conversionVelocity).toBe(30);
    expect(body.data.slaStatuses.Met).toBe(1);
  });

  it("should not leak Tenant A's lead metrics when Tenant B requests analytics", async () => {
    const orgB = "org-tenant-b";
    const userB = "user-b";

    // Insert mock seed leads for Tenant B
    await withTenant(orgB, mockDb, async () => {
      // Clean first
      const leads = await dbStore.leads.findMany();
      for (const l of leads) {
        if (l.orgId === orgB) {
          await dbStore.leads.delete(l.id);
        }
      }

      await dbStore.leads.insert({
        orgId: orgB,
        ownerId: userB,
        status: "Working",
        email: "working@tenantb.com",
        company: "Tenant B Corp",
      });
    });

    // Create session token for Tenant B
    const tokenB = await createSessionToken({
      userId: userB,
      orgId: orgB,
      roleId: "role-b",
      permissionsMask: 7,
    });

    const res = await app.request("/api/dashboard/analytics", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${tokenB}`,
      },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.totalLeads).toBe(1);
    expect(body.data.statusCounts.Working).toBe(1);
    expect(body.data.statusCounts.New).toBeUndefined();
    expect(body.data.fuzzedCount).toBe(0);
  });
});
