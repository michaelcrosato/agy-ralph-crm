import { createSessionToken } from "@crm/auth";
import { dbStore, mockDb, withTenant } from "@crm/db";
import { beforeEach, describe, expect, it } from "vitest";
import { createTestApp } from "./_harness";

const app = createTestApp();

describe("Marketing Sequence Daily Sending Throttle Limit Tests", () => {
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

  it("should enforce dailySendLimit by deferring subsequent executions, creating audit trails, and verifying RLS isolation", async () => {
    let leadId1 = "";
    let leadId2 = "";
    let templateId = "";
    let sequenceId = "";

    // 1. Setup email template and two leads for Tenant A
    await withTenant(orgA, mockDb, async () => {
      const lead1 = await dbStore.leads.insert({
        orgId: orgA,
        ownerId: "user-a",
        status: "New",
        email: "lead1@acme.com",
        company: "Acme Lead 1",
        convertedAccountId: null,
        convertedContactId: null,
        custom: null,
      });
      leadId1 = lead1.id;

      const lead2 = await dbStore.leads.insert({
        orgId: orgA,
        ownerId: "user-a",
        status: "New",
        email: "lead2@acme.com",
        company: "Acme Lead 2",
        convertedAccountId: null,
        convertedContactId: null,
        custom: null,
      });
      leadId2 = lead2.id;

      const t1 = await dbStore.emailTemplates.insert({
        orgId: orgA,
        name: "Welcome Drip",
        subject: "Welcome, {{lead.company}}!",
        body: "Hi from Acme.",
      });
      templateId = t1.id;
    });

    // 2. Create Sequence for Tenant A with dailySendLimit: 1
    const createSeqRes = await app.request("/api/sequences", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenTenantA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "Throttled Flow",
        description: "Sequence with strict sending limit",
        status: "active",
        dailySendLimit: 1,
      }),
    });
    expect(createSeqRes.status).toBe(200);
    const createSeqBody = await createSeqRes.json();
    sequenceId = createSeqBody.sequence.id;
    expect(sequenceId).toBeDefined();
    expect(createSeqBody.sequence.dailySendLimit).toBe(1);

    // 3. Add Step 1 (immediate, delayDays = 0)
    const addStepRes = await app.request(`/api/sequences/${sequenceId}/steps`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenTenantA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        stepNumber: 1,
        delayDays: 0,
        templateId,
      }),
    });
    expect(addStepRes.status).toBe(200);

    // 4. Enroll Lead 1 and Lead 2 in Sequence
    const enrollRes1 = await app.request(
      `/api/sequences/${sequenceId}/enroll`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenTenantA}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          recordType: "lead",
          recordId: leadId1,
        }),
      },
    );
    expect(enrollRes1.status).toBe(200);
    const m1Body = await enrollRes1.json();
    const membershipId1 = m1Body.membership.id;

    const enrollRes2 = await app.request(
      `/api/sequences/${sequenceId}/enroll`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenTenantA}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          recordType: "lead",
          recordId: leadId2,
        }),
      },
    );
    expect(enrollRes2.status).toBe(200);
    const m2Body = await enrollRes2.json();
    const membershipId2 = m2Body.membership.id;

    // 5. Execute sequence (simulated cron run)
    const execRes1 = await app.request("/api/sequences/execute", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenTenantA}`,
      },
    });
    expect(execRes1.status).toBe(200);
    const execBody1 = await execRes1.json();
    // One should be processed successfully, and the other should be deferred (not processed)
    expect(execBody1.processedCount).toBe(1);

    // 6. Assert executed vs deferred status in mock DB under Tenant A
    await withTenant(orgA, mockDb, async () => {
      const activities = await dbStore.activities.findMany();
      // Only 1 email activity should be dispatched
      expect(activities.length).toBe(1);

      const m1 =
        await dbStore.marketingSequenceMemberships.findOne(membershipId1);
      const m2 =
        await dbStore.marketingSequenceMemberships.findOne(membershipId2);

      const executed = [m1, m2].find((m) => m?.currentStepNumber === 1);
      const deferred = [m1, m2].find((m) => m?.currentStepNumber === 0);

      expect(executed).toBeDefined();
      expect(deferred).toBeDefined();
      if (!executed || !deferred) {
        throw new Error("Expected both an executed and deferred membership");
      }
      expect(executed.status).toBe("completed"); // Since there are no further steps, it resolves to completed
      expect(deferred.status).toBe("active"); // Deferral keeps it active for next day

      // Deferral nextExecutionAt should be pushed into future (~24 hours)
      const diffMs = new Date(deferred.nextExecutionAt).getTime() - Date.now();
      expect(diffMs).toBeGreaterThan(23 * 60 * 60 * 1000);

      // Verify that audit log was generated for the deferral/throttling event
      const logs = await dbStore.auditLogs.findMany();
      const deferralLog = logs.find(
        (log) =>
          log.recordId === deferred.id &&
          log.action === "membership_schedule_deferred",
      );
      expect(deferralLog).toBeDefined();
      expect(deferralLog?.changes.throttle_reason?.after).toContain(
        "Daily sending throttle reached",
      );
    });

    // 7. Test invalid Daily Send Limit payload returns 400 Bad Request
    const invalidLimitRes = await app.request(
      `/api/sequences/${sequenceId}/schedule`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenTenantA}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          dailySendLimit: -5,
        }),
      },
    );
    expect(invalidLimitRes.status).toBe(400);

    const invalidLimitTypeRes = await app.request(
      `/api/sequences/${sequenceId}/schedule`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenTenantA}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          dailySendLimit: "not-a-number",
        }),
      },
    );
    expect(invalidLimitTypeRes.status).toBe(400);

    // 8. Test successful update of dailySendLimit via schedule endpoint
    const updateLimitRes = await app.request(
      `/api/sequences/${sequenceId}/schedule`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenTenantA}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          dailySendLimit: 10,
        }),
      },
    );
    expect(updateLimitRes.status).toBe(200);
    const updateLimitBody = await updateLimitRes.json();
    expect(updateLimitBody.data.dailySendLimit).toBe(10);

    // 9. Verify RLS tenant isolation: Tenant B cannot update Tenant A's sequence schedule
    const updateLimitBRes = await app.request(
      `/api/sequences/${sequenceId}/schedule`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenTenantB}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          dailySendLimit: 100,
        }),
      },
    );
    // Should return 404/mismatch
    expect(updateLimitBRes.status).toBe(404);
  });
});
