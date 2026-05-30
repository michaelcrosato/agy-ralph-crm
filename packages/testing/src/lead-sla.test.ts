import { createSessionToken } from "@crm/auth";
import { dbStore, mockDb, withTenant } from "@crm/db";
import { beforeEach, describe, expect, it } from "vitest";
import { createTestApp } from "./_harness";

const app = createTestApp();

describe("Lead SLA & Response Aging Tracking API & Integration Tests", () => {
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

  it("should support CRUD for SLA targets under active RLS context", async () => {
    // 1. Create an SLA target under Tenant A
    const resCreate = await app.request("/api/leads/sla-targets", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenTenantA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        maxResponseTimeMinutes: 30,
      }),
    });
    expect(resCreate.status).toBe(201);
    const bodyCreate = await resCreate.json();
    expect(bodyCreate.success).toBe(true);
    expect(bodyCreate.data.maxResponseTimeMinutes).toBe(30);
    expect(bodyCreate.data.isActive).toBe(1);

    // 2. Fetch the active SLA target
    const resGet = await app.request("/api/leads/sla-targets", {
      method: "GET",
      headers: { Authorization: `Bearer ${tokenTenantA}` },
    });
    expect(resGet.status).toBe(200);
    const bodyGet = await resGet.json();
    expect(bodyGet.success).toBe(true);
    expect(bodyGet.data.maxResponseTimeMinutes).toBe(30);

    // 3. Create a second SLA target (which should deactivate the first one)
    const resCreate2 = await app.request("/api/leads/sla-targets", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenTenantA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        maxResponseTimeMinutes: 45,
      }),
    });
    expect(resCreate2.status).toBe(201);

    // 4. Fetch the active SLA target again, verify it is now the second one
    const resGet2 = await app.request("/api/leads/sla-targets", {
      method: "GET",
      headers: { Authorization: `Bearer ${tokenTenantA}` },
    });
    const bodyGet2 = await resGet2.json();
    expect(bodyGet2.data.maxResponseTimeMinutes).toBe(45);

    // Verify first target was deactivated
    await withTenant(orgA, mockDb, async () => {
      const all = await dbStore.leadSlaTargets.findMany();
      const inactive = all.find((t) => t.maxResponseTimeMinutes === 30);
      expect(inactive?.isActive).toBe(0);
    });
  });

  it("should automatically scaffold a pending SLA tracker when a lead is created", async () => {
    // 1. Setup SLA Target
    await withTenant(orgA, mockDb, async () => {
      await dbStore.leadSlaTargets.insert({
        orgId: orgA,
        maxResponseTimeMinutes: 15,
        isActive: 1,
      });
    });

    // 2. Create lead via API
    const resLead = await app.request("/api/leads", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenTenantA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: "customer@example.com",
        company: "Customer Corp",
        status: "New",
      }),
    });
    expect(resLead.status).toBe(200);
    const bodyLead = await resLead.json();
    const leadId = bodyLead.data.id;

    // 3. Verify SLA tracker was created in the database and is Pending
    await withTenant(orgA, mockDb, async () => {
      const trackers = await dbStore.leadSlaTrackers.findForLead(leadId);
      expect(trackers).toHaveLength(1);
      expect(trackers[0].status).toBe("Pending");
      expect(trackers[0].respondedAt).toBeNull();
      expect(trackers[0].responseTimeMinutes).toBeNull();
    });
  });

  it("should support marking a lead as responded and calculating response status correctly", async () => {
    let leadId = "";
    let _trackerId = "";

    // 1. Setup SLA target & lead with tracker
    await withTenant(orgA, mockDb, async () => {
      const target = await dbStore.leadSlaTargets.insert({
        orgId: orgA,
        maxResponseTimeMinutes: 60,
        isActive: 1,
      });

      const lead = await dbStore.leads.insert({
        orgId: orgA,
        ownerId: "user-a",
        status: "New",
        email: "contact@test.com",
        company: "Test Inc",
        convertedAccountId: null,
        convertedContactId: null,
        custom: null,
      });
      leadId = lead.id;

      // Mock creation 10 minutes ago
      const tenMinsAgo = new Date(Date.now() - 10 * 60 * 1000);
      const tracker = await dbStore.leadSlaTrackers.insert({
        orgId: orgA,
        leadId: leadId,
        targetId: target.id,
        status: "Pending",
        respondedAt: null,
        responseTimeMinutes: null,
      });
      _trackerId = tracker.id;

      // Manually backdate the tracker creation for mock test
      tracker.createdAt = tenMinsAgo;
    });

    // 2. Respond to the lead (should be Met since 10 mins < 60 mins target)
    const resRespond = await app.request(`/api/leads/${leadId}/respond`, {
      method: "POST",
      headers: { Authorization: `Bearer ${tokenTenantA}` },
    });
    expect(resRespond.status).toBe(200);
    const bodyRespond = await resRespond.json();
    expect(bodyRespond.success).toBe(true);
    expect(bodyRespond.data.status).toBe("Met");
    expect(bodyRespond.data.responseTimeMinutes).toBe(10);
    expect(bodyRespond.data.respondedAt).not.toBeNull();

    // 3. Verify audit log entry
    await withTenant(orgA, mockDb, async () => {
      const logs = await dbStore.auditLogs.findMany();
      const respondLog = logs.find(
        (l) => l.action === "respond" && l.recordId === leadId,
      );
      expect(respondLog).toBeDefined();
    });
  });

  it("should capture breached response targets during aging breach scans", async () => {
    let leadId = "";

    // Setup SLA target & lead with old tracker
    await withTenant(orgA, mockDb, async () => {
      const target = await dbStore.leadSlaTargets.insert({
        orgId: orgA,
        maxResponseTimeMinutes: 30,
        isActive: 1,
      });

      const lead = await dbStore.leads.insert({
        orgId: orgA,
        ownerId: "user-a",
        status: "New",
        email: "late@test.com",
        company: "Late Corp",
        convertedAccountId: null,
        convertedContactId: null,
        custom: null,
      });
      leadId = lead.id;

      // Mock creation 45 minutes ago (breaching 30 min SLA)
      const fortyFiveMinsAgo = new Date(Date.now() - 45 * 60 * 1000);
      const tracker = await dbStore.leadSlaTrackers.insert({
        orgId: orgA,
        leadId: leadId,
        targetId: target.id,
        status: "Pending",
        respondedAt: null,
        responseTimeMinutes: null,
      });
      tracker.createdAt = fortyFiveMinsAgo;
    });

    // Run SLA breach scan via API
    const resScan = await app.request("/api/leads/sla-breaches", {
      method: "GET",
      headers: { Authorization: `Bearer ${tokenTenantA}` },
    });
    expect(resScan.status).toBe(200);
    const bodyScan = await resScan.json();
    expect(bodyScan.success).toBe(true);
    expect(bodyScan.data).toHaveLength(1);
    expect(bodyScan.data[0].leadId).toBe(leadId);
    expect(bodyScan.data[0].status).toBe("Breached");
    expect(bodyScan.data[0].responseTimeMinutes).toBe(45);
  });

  it("should enforce strict multi-tenant RLS isolation on all SLA targets and trackers", async () => {
    let targetAId = "";
    let leadAId = "";

    // 1. Create target and lead under Tenant A
    await withTenant(orgA, mockDb, async () => {
      const target = await dbStore.leadSlaTargets.insert({
        orgId: orgA,
        maxResponseTimeMinutes: 10,
        isActive: 1,
      });
      targetAId = target.id;

      const lead = await dbStore.leads.insert({
        orgId: orgA,
        ownerId: "user-a",
        status: "New",
        email: "tenantA@test.com",
        company: "Tenant A Corp",
        convertedAccountId: null,
        convertedContactId: null,
        custom: null,
      });
      leadAId = lead.id;

      await dbStore.leadSlaTrackers.insert({
        orgId: orgA,
        leadId: leadAId,
        targetId: targetAId,
        status: "Pending",
        respondedAt: null,
        responseTimeMinutes: null,
      });
    });

    // 2. Tenant B attempts to fetch Tenant A's SLA Target via GET targets endpoint -> should return null active config
    const resGetLeak = await app.request("/api/leads/sla-targets", {
      method: "GET",
      headers: { Authorization: `Bearer ${tokenTenantB}` },
    });
    expect(resGetLeak.status).toBe(200);
    const bodyGetLeak = await resGetLeak.json();
    expect(bodyGetLeak.data).toBeNull();

    // 3. Tenant B attempts to mark Tenant A's lead as responded -> should return 404
    const resRespondLeak = await app.request(`/api/leads/${leadAId}/respond`, {
      method: "POST",
      headers: { Authorization: `Bearer ${tokenTenantB}` },
    });
    expect(resRespondLeak.status).toBe(404);
  });
});
