import { checkSlabreaches } from "@crm/core";
import { dbStore, mockDb, withTenant } from "@crm/db";
import { beforeEach, describe, expect, it } from "vitest";

describe("Lead SLA Breaches Email Notification Service Worker Tests", () => {
  const orgA = "org-tenant-a";
  const orgB = "org-tenant-b";

  beforeEach(async () => {
    dbStore.clear();
  });

  it("should trigger breach alerts, persist activities and mock emails, and maintain idempotency and multi-tenant RLS isolation", async () => {
    let breachedLeadId = "";
    let cleanLeadId = "";
    let tenantBLeadId = "";

    let targetAId = "";
    let targetBId = "";

    // 1. Setup SLA Targets under Tenant A and Tenant B
    await withTenant(orgA, mockDb, async () => {
      const target = await dbStore.leadSlaTargets.insert({
        orgId: orgA,
        maxResponseTimeMinutes: 30,
        isActive: 1,
      });
      targetAId = target.id;
    });

    await withTenant(orgB, mockDb, async () => {
      const target = await dbStore.leadSlaTargets.insert({
        orgId: orgB,
        maxResponseTimeMinutes: 30,
        isActive: 1,
      });
      targetBId = target.id;
    });

    // 2. Setup leads and trackers
    const currentTime = new Date();
    const fortyMinsAgo = new Date(currentTime.getTime() - 40 * 60 * 1000);
    const tenMinsAgo = new Date(currentTime.getTime() - 10 * 60 * 1000);

    // Tenant A - Breached Lead
    await withTenant(orgA, mockDb, async () => {
      const lead = await dbStore.leads.insert({
        orgId: orgA,
        ownerId: "rep-a",
        status: "New",
        email: "breached-customer@example.com",
        company: "Breach Corp",
        convertedAccountId: null,
        convertedContactId: null,
        custom: {},
      });
      breachedLeadId = lead.id;

      // Seed tracker manually backdated
      const tracker = await dbStore.leadSlaTrackers.insert({
        orgId: orgA,
        leadId: breachedLeadId,
        targetId: targetAId,
        status: "Pending",
        respondedAt: null,
        responseTimeMinutes: null,
      });

      // Override createdAt backdated in store directly for testing
      const allTrackers = await dbStore.leadSlaTrackers.findMany();
      const directTracker = allTrackers.find((t) => t.id === tracker.id);
      if (directTracker) {
        directTracker.createdAt = fortyMinsAgo;
      }
    });

    // Tenant A - Clean Lead (not breached)
    await withTenant(orgA, mockDb, async () => {
      const lead = await dbStore.leads.insert({
        orgId: orgA,
        ownerId: "rep-a",
        status: "New",
        email: "clean-customer@example.com",
        company: "Clean Corp",
        convertedAccountId: null,
        convertedContactId: null,
        custom: {},
      });
      cleanLeadId = lead.id;

      const tracker = await dbStore.leadSlaTrackers.insert({
        orgId: orgA,
        leadId: cleanLeadId,
        targetId: targetAId,
        status: "Pending",
        respondedAt: null,
        responseTimeMinutes: null,
      });

      const allTrackers = await dbStore.leadSlaTrackers.findMany();
      const directTracker = allTrackers.find((t) => t.id === tracker.id);
      if (directTracker) {
        directTracker.createdAt = tenMinsAgo;
      }
    });

    // Tenant B - Breached Lead (enforces RLS security check)
    await withTenant(orgB, mockDb, async () => {
      const lead = await dbStore.leads.insert({
        orgId: orgB,
        ownerId: "rep-b",
        status: "New",
        email: "tenantb-breached@example.com",
        company: "B Corp",
        convertedAccountId: null,
        convertedContactId: null,
        custom: {},
      });
      tenantBLeadId = lead.id;

      const tracker = await dbStore.leadSlaTrackers.insert({
        orgId: orgB,
        leadId: tenantBLeadId,
        targetId: targetBId,
        status: "Pending",
        respondedAt: null,
        responseTimeMinutes: null,
      });

      const allTrackers = await dbStore.leadSlaTrackers.findMany();
      const directTracker = allTrackers.find((t) => t.id === tracker.id);
      if (directTracker) {
        directTracker.createdAt = fortyMinsAgo;
      }
    });

    // 3. Execute checkSlabreaches for Tenant A
    const breachCountA = await checkSlabreaches(dbStore, orgA, currentTime);
    expect(breachCountA).toBe(1);

    // 4. Verify Tenant A - Breached Tracker updated
    await withTenant(orgA, mockDb, async () => {
      const trackers =
        await dbStore.leadSlaTrackers.findForLead(breachedLeadId);
      expect(trackers[0].status).toBe("Breached");
      expect(trackers[0].responseTimeMinutes).toBe(40);

      // Verify Clean Tracker remains pending
      const cleanTrackers =
        await dbStore.leadSlaTrackers.findForLead(cleanLeadId);
      expect(cleanTrackers[0].status).toBe("Pending");

      // Verify custom metadata slaAlertSent is true on breached lead
      const lead = await dbStore.leads.findOne(breachedLeadId);
      expect(lead?.custom?.slaAlertSent).toBe(true);

      // Verify System Notification task created
      const activities = await dbStore.activities.findMany();
      const systemNotification = activities.find(
        (a) => a.type === "task" && a.subject === "SLA Breach Notification",
      );
      expect(systemNotification).toBeDefined();
      expect(systemNotification?.body).toContain(breachedLeadId);

      // Verify outbound mock email created
      const mockEmail = activities.find(
        (a) => a.type === "email" && a.subject.startsWith("SLA Breach Alert:"),
      );
      expect(mockEmail).toBeDefined();
      expect(mockEmail?.custom?.to).toContain("breached-customer@example.com");

      // Verify audit log created
      const auditLogs = await dbStore.auditLogs.findMany();
      const emailAuditLog = auditLogs.find(
        (log) =>
          log.recordId === mockEmail?.id && log.recordType === "EmailLog",
      );
      expect(emailAuditLog).toBeDefined();
      expect(emailAuditLog?.action).toBe("create");
    });

    // 5. Verify Tenant B's breached lead did NOT get touched due to strict RLS
    await withTenant(orgB, mockDb, async () => {
      const trackers = await dbStore.leadSlaTrackers.findForLead(tenantBLeadId);
      expect(trackers[0].status).toBe("Pending"); // remains Pending because worker ran under Tenant A context!

      const activities = await dbStore.activities.findMany();
      expect(activities).toHaveLength(0); // Tenant B has zero activities/notifications
    });

    // 6. Test Idempotency (prevent double alerts)
    // Manually reset tracker status back to Pending to simulate another check, but keeping custom metadata
    await withTenant(orgA, mockDb, async () => {
      const trackers =
        await dbStore.leadSlaTrackers.findForLead(breachedLeadId);
      await dbStore.leadSlaTrackers.update(trackers[0].id, {
        status: "Pending",
      });
    });

    const breachCountSecondRun = await checkSlabreaches(
      dbStore,
      orgA,
      currentTime,
    );
    // Since custom metadata has slaAlertSent = true, it should NOT generate any additional alerts
    expect(breachCountSecondRun).toBe(1); // tracker is evaluated again, but we skipped lead alert generation

    await withTenant(orgA, mockDb, async () => {
      const activities = await dbStore.activities.findMany();
      // Should still be exactly 2 activities (1 task, 1 email)
      const tasks = activities.filter((a) => a.type === "task");
      const emails = activities.filter((a) => a.type === "email");
      expect(tasks).toHaveLength(1);
      expect(emails).toHaveLength(1);
    });
  });
});
