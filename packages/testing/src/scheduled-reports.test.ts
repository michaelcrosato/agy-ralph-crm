import { createSessionToken } from "@crm/auth";
import { dbStore, mockDb, withTenant } from "@crm/db";
import { beforeEach, describe, expect, it } from "vitest";
import app from "../../../apps/api/src/index";

describe("Scheduled Reports & Email Delivery Engine", () => {
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

  describe("API Endpoint Routes & RLS Tenancy Isolation", () => {
    it("should allow managing scheduled reports under strict tenant isolation", async () => {
      // 1. Create a report under Tenant A
      let reportId = "";
      await withTenant(orgA, mockDb, async () => {
        const report = await dbStore.reports.insert({
          orgId: orgA,
          name: "Tenant A Lead Report",
          objectType: "leads",
          groupBy: "status",
          aggregateField: null,
          aggregateFunc: "count",
        });
        reportId = report.id;
      });

      // 2. Tenant A schedules the report
      const createRes = await app.request("/api/reports/scheduled", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenTenantA}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          reportId,
          recipientEmail: "manager@tenanta.com",
          frequency: "weekly",
          isActive: 1,
        }),
      });
      expect(createRes.status).toBe(200);
      const createBody = await createRes.json();
      expect(createBody.success).toBe(true);
      expect(createBody.schedule.recipientEmail).toBe("manager@tenanta.com");
      const scheduleId = createBody.schedule.id;

      // 3. Tenant A lists their schedules
      const listResA = await app.request("/api/reports/scheduled", {
        method: "GET",
        headers: { Authorization: `Bearer ${tokenTenantA}` },
      });
      expect(listResA.status).toBe(200);
      const listBodyA = await listResA.json();
      expect(listBodyA.schedules.length).toBe(1);
      expect(listBodyA.schedules[0].id).toBe(scheduleId);

      // 4. Tenant B tries to list schedules, gets empty array (proving RLS)
      const listResB = await app.request("/api/reports/scheduled", {
        method: "GET",
        headers: { Authorization: `Bearer ${tokenTenantB}` },
      });
      expect(listResB.status).toBe(200);
      const listBodyB = await listResB.json();
      expect(listBodyB.schedules.length).toBe(0);

      // 5. Tenant B tries to delete Tenant A's schedule, gets 404/error (proving RLS)
      const deleteResB = await app.request(
        `/api/reports/scheduled/${scheduleId}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${tokenTenantB}` },
        },
      );
      expect(deleteResB.status).toBe(404);

      // Tenant A schedule still exists
      const checkResA = await app.request("/api/reports/scheduled", {
        method: "GET",
        headers: { Authorization: `Bearer ${tokenTenantA}` },
      });
      const checkBodyA = await checkResA.json();
      expect(checkBodyA.schedules.length).toBe(1);

      // 6. Tenant A successfully deletes their schedule
      const deleteResA = await app.request(
        `/api/reports/scheduled/${scheduleId}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${tokenTenantA}` },
        },
      );
      expect(deleteResA.status).toBe(200);
      const deleteBodyA = await deleteResA.json();
      expect(deleteBodyA.success).toBe(true);
    });
  });

  describe("Scheduled Execution Loop", () => {
    it("should process due schedules, aggregate reports, and log runs successfully", async () => {
      let reportId = "";
      let scheduleId = "";

      // Setup mock data for Tenant A
      await withTenant(orgA, mockDb, async () => {
        // 1. Create Report
        const report = await dbStore.reports.insert({
          orgId: orgA,
          name: "Sales Report",
          objectType: "leads",
          groupBy: "status",
          aggregateField: null,
          aggregateFunc: "count",
        });
        reportId = report.id;

        // 2. Create lead records to group by status
        await dbStore.leads.insert({
          orgId: orgA,
          ownerId: userA,
          status: "New",
          email: "l1@t.com",
          company: "C1",
          convertedAccountId: null,
          convertedContactId: null,
          custom: null,
        });

        await dbStore.leads.insert({
          orgId: orgA,
          ownerId: userA,
          status: "New",
          email: "l2@t.com",
          company: "C2",
          convertedAccountId: null,
          convertedContactId: null,
          custom: null,
        });

        await dbStore.leads.insert({
          orgId: orgA,
          ownerId: userA,
          status: "Working",
          email: "l3@t.com",
          company: "C3",
          convertedAccountId: null,
          convertedContactId: null,
          custom: null,
        });

        // 3. Create a schedule that is due (nextRunAt set in the past)
        const pastDate = new Date();
        pastDate.setMinutes(pastDate.getMinutes() - 10);

        const schedule = await dbStore.scheduledReports.insert({
          orgId: orgA,
          reportId,
          recipientEmail: "exec@tenanta.com",
          frequency: "daily",
          isActive: 1,
          nextRunAt: pastDate,
        });
        scheduleId = schedule.id;

        // Ensure we have a webhook subscription registered to test dispatching
        await dbStore.webhooks.insert({
          orgId: orgA,
          targetUrl: "https://tenanta.com/webhook",
          secret: "secret",
          status: "active",
        });
      });

      // 4. Trigger run-pending via Hono API
      const runRes = await app.request("/api/reports/scheduled/run-pending", {
        method: "POST",
        headers: { Authorization: `Bearer ${tokenTenantA}` },
      });
      expect(runRes.status).toBe(200);
      const runBody = await runRes.json();
      expect(runBody.success).toBe(true);
      expect(runBody.processed).toBe(1);

      // 5. Verify results inside Tenant A context
      await withTenant(orgA, mockDb, async () => {
        // Schedule nextRunAt is now in the future
        const sched = await dbStore.scheduledReports.findOne(scheduleId);
        expect(sched).not.toBeNull();
        expect(new Date(sched?.nextRunAt ?? "").getTime()).toBeGreaterThan(
          Date.now(),
        );

        // Log record created
        const runs = await dbStore.scheduledReportRuns.findMany();
        expect(runs.length).toBe(1);
        expect(runs[0].scheduledReportId).toBe(scheduleId);
        expect(runs[0].status).toBe("success");
        expect(runs[0].errorMessage).toBeNull();

        // Webhook delivery has report.delivered event
        const deliveries = await dbStore.webhookDeliveries.findMany();
        expect(deliveries.length).toBe(1);

        const payloadData = JSON.parse(deliveries[0].payload);
        expect(payloadData.event).toBe("report.delivered");
        expect(payloadData.data.recipientEmail).toBe("exec@tenanta.com");
        expect(payloadData.data.result.reportName).toBe("Sales Report");
        expect(payloadData.data.result.data).toEqual([
          { group: "New", value: 2 },
          { group: "Working", value: 1 },
        ]);
      });
    });

    it("should gracefully handle failures during a scheduled report run and log them", async () => {
      let scheduleId = "";

      // Setup a broken schedule (references a non-existent report ID)
      await withTenant(orgA, mockDb, async () => {
        const pastDate = new Date();
        pastDate.setMinutes(pastDate.getMinutes() - 10);

        const schedule = await dbStore.scheduledReports.insert({
          orgId: orgA,
          reportId: "non-existent-report-uuid",
          recipientEmail: "exec@tenanta.com",
          frequency: "daily",
          isActive: 1,
          nextRunAt: pastDate,
        });
        scheduleId = schedule.id;
      });

      // Trigger run-pending via Hono API
      const runRes = await app.request("/api/reports/scheduled/run-pending", {
        method: "POST",
        headers: { Authorization: `Bearer ${tokenTenantA}` },
      });
      expect(runRes.status).toBe(200);
      const runBody = await runRes.json();
      expect(runBody.success).toBe(true);
      expect(runBody.processed).toBe(1);

      // Verify that the run failure is logged without throwing
      await withTenant(orgA, mockDb, async () => {
        const runs = await dbStore.scheduledReportRuns.findMany();
        expect(runs.length).toBe(1);
        expect(runs[0].scheduledReportId).toBe(scheduleId);
        expect(runs[0].status).toBe("failed");
        expect(runs[0].errorMessage).toContain(
          "Report with ID non-existent-report-uuid not found",
        );

        // Webhook outbox has NO events since the run failed
        const outbox = await dbStore.webhookOutbox.findMany();
        expect(outbox.length).toBe(0);
      });
    });
  });
});
