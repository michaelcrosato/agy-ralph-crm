import { createSessionToken } from "@crm/auth";
import { enrollInSequence, executePendingSequenceSteps } from "@crm/core";
import { dbStore, mockDb, withTenant } from "@crm/db";
import { beforeEach, describe, expect, it } from "vitest";
import app from "../../../apps/api/src/index";

describe("Marketing Sequence Sending Schedule & Deferral Engine Tests (Task 0187)", () => {
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

  it("should configure sequence sending schedule via API with RLS tenant isolation", async () => {
    let sequenceId = "";

    await withTenant(orgA, mockDb, async () => {
      const seq = await dbStore.marketingSequences.insert({
        orgId: orgA,
        name: "Acme High Value Sequence",
        description: "B2B Marketing sequence",
        status: "active",
        sendingWindowStart: null,
        sendingWindowEnd: null,
        sendingDays: null,
      });
      sequenceId = seq.id;
    });

    // 1. Configure schedule via POST API (Tenant A)
    const scheduleRes = await app.request(
      `/api/sequences/${sequenceId}/schedule`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenTenantA}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sendingWindowStart: "09:30",
          sendingWindowEnd: "17:30",
          sendingDays: [1, 2, 3, 4, 5],
        }),
      },
    );

    expect(scheduleRes.status).toBe(200);
    const scheduleData = await scheduleRes.json();
    expect(scheduleData.success).toBe(true);
    expect(scheduleData.data.sendingWindowStart).toBe("09:30");
    expect(scheduleData.data.sendingWindowEnd).toBe("17:30");
    expect(scheduleData.data.sendingDays).toEqual([1, 2, 3, 4, 5]);

    // Verify Audit log was created in Tenant A
    await withTenant(orgA, mockDb, async () => {
      const logs = await dbStore.auditLogs.findMany();
      const auditLog = logs.find(
        (l) => l.action === "sequence_schedule_updated",
      );
      expect(auditLog).toBeDefined();
      expect(auditLog?.recordId).toBe(sequenceId);
      expect(auditLog?.changes.sendingWindowStart.after).toBe("09:30");
    });

    // 2. Validate time format constraints
    const badTimeRes = await app.request(
      `/api/sequences/${sequenceId}/schedule`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenTenantA}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sendingWindowStart: "9:00", // Invalid format (needs leading 0)
        }),
      },
    );
    expect(badTimeRes.status).toBe(400);

    // 3. Tenant B cross-tenant configuration attempt -> 404
    const badRes = await app.request(`/api/sequences/${sequenceId}/schedule`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenTenantB}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sendingWindowStart: "10:00",
      }),
    });
    expect(badRes.status).toBe(404);
  });

  it("should defer step executions when current time falls outside allowed schedule", async () => {
    let _sequenceId = "";
    let membershipId = "";
    const saturdayTime = new Date("2026-05-30T12:00:00Z");

    await withTenant(orgA, mockDb, async () => {
      const seq = await dbStore.marketingSequences.insert({
        orgId: orgA,
        name: "Restricted Time Sequence",
        description: "Mon-Fri 09:00-17:00 Sequence",
        status: "active",
        sendingWindowStart: "09:00",
        sendingWindowEnd: "17:00",
        sendingDays: [1, 2, 3, 4, 5],
      });
      _sequenceId = seq.id;

      const tpl = await dbStore.emailTemplates.insert({
        orgId: orgA,
        name: "Out of Office Template",
        subject: "Hello!",
        body: "Welcome to our newsletter.",
      });

      await dbStore.marketingSequenceSteps.insert({
        orgId: orgA,
        sequenceId: seq.id,
        stepNumber: 1,
        delayDays: 0,
        templateId: tpl.id,
      });

      const lead = await dbStore.leads.insert({
        orgId: orgA,
        ownerId: "user-a",
        status: "Open",
        email: "lead@acme.com",
        company: "Acme Corp",
      });

      const membership = await enrollInSequence(
        dbStore,
        orgA,
        seq.id,
        "lead",
        lead.id,
      );
      membershipId = membership.id;

      // Backdate nextExecutionAt relative to test clock to avoid timezone/current time failures
      await dbStore.marketingSequenceMemberships.update(membership.id, {
        nextExecutionAt: new Date(saturdayTime.getTime() - 1000),
      });
    });

    // Case A: Run worker on a Saturday (May 30, 2026 is a Saturday)
    // 2026-05-30T12:00:00Z (Saturday, DayOfWeek = 6)
    await withTenant(orgA, mockDb, async () => {
      const processedCount = await executePendingSequenceSteps(
        dbStore,
        saturdayTime,
      );
      expect(processedCount).toBe(0);

      // Verify that nextExecutionAt is deferred to the next Monday (June 1, 2026) at 09:00 UTC
      const m =
        await dbStore.marketingSequenceMemberships.findOne(membershipId);
      expect(m?.nextExecutionAt.toISOString()).toBe("2026-06-01T09:00:00.000Z");

      // Verify audit trail logged the deferral
      const logs = await dbStore.auditLogs.findMany();
      const deferLog = logs.find(
        (l) => l.action === "membership_schedule_deferred",
      );
      expect(deferLog).toBeDefined();
    });

    // Case B: Run worker on a Wednesday at 05:00 UTC (June 3, 2026 is a Wednesday)
    // Allowed day, but before daily sending window start (09:00)
    const earlyWednesday = new Date("2026-06-03T05:00:00Z");
    await withTenant(orgA, mockDb, async () => {
      // Manually set membership nextExecutionAt back to a past time for testing
      await dbStore.marketingSequenceMemberships.update(membershipId, {
        nextExecutionAt: new Date("2026-06-02T12:00:00Z"),
      });

      const processedCount = await executePendingSequenceSteps(
        dbStore,
        earlyWednesday,
      );
      expect(processedCount).toBe(0);

      // Defer to today (June 3, 2026) at 09:00 UTC
      const m =
        await dbStore.marketingSequenceMemberships.findOne(membershipId);
      expect(m?.nextExecutionAt.toISOString()).toBe("2026-06-03T09:00:00.000Z");
    });

    // Case C: Run worker inside allowed sending window (Wednesday, June 3, 2026 at 12:00 UTC)
    const withinWindowTime = new Date("2026-06-03T12:00:00Z");
    await withTenant(orgA, mockDb, async () => {
      // Set membership nextExecutionAt back to withinWindowTime (or past) to make it ready
      await dbStore.marketingSequenceMemberships.update(membershipId, {
        nextExecutionAt: new Date("2026-06-03T11:00:00Z"),
      });

      const processedCount = await executePendingSequenceSteps(
        dbStore,
        withinWindowTime,
      );
      expect(processedCount).toBe(1);

      // Verify step execution finished, membership status is completed
      const m =
        await dbStore.marketingSequenceMemberships.findOne(membershipId);
      expect(m?.status).toBe("completed");

      // Verify that activity (email logs) was created
      const activities = await dbStore.activities.findMany();
      expect(activities).toHaveLength(1);
    });
  });
});
