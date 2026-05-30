import { createSessionToken } from "@crm/auth";
import { enrollInSequence, executePendingSequenceSteps } from "@crm/core";
import { dbStore, mockDb, withTenant } from "@crm/db";
import { beforeEach, describe, expect, it } from "vitest";
import app from "../../../apps/api/src/index";

describe("Marketing Sequence Snooze & Resume Engine API & Logic Tests (Task 0186)", () => {
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

  it("should support manual snooze and resume via API with strict RLS tenant isolation", async () => {
    let membershipId = "";

    await withTenant(orgA, mockDb, async () => {
      // Setup sequence, template, step, and lead
      const seq = await dbStore.marketingSequences.insert({
        orgId: orgA,
        name: "Enterprise Snoozable Sequence",
        description: "B2B sequence with snooze capability",
        status: "active",
      });

      const tpl = await dbStore.emailTemplates.insert({
        orgId: orgA,
        name: "Welcome Template",
        subject: "Welcome!",
        body: "Glad to have you.",
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
        email: "prospect@example.com",
        company: "Example Inc",
      });

      // Enroll lead
      const membership = await enrollInSequence(
        dbStore,
        orgA,
        seq.id,
        "lead",
        lead.id,
      );
      membershipId = membership.id;
      expect(membership.status).toBe("active");
    });

    // 1. Snooze via POST API (Tenant A)
    const snoozeDate = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7); // 7 days from now
    const snoozeRes = await app.request(
      `/api/sequences/memberships/${membershipId}/snooze`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenTenantA}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          snoozeUntil: snoozeDate.toISOString(),
          reason: "Manual pause for high-touch sales outreach",
        }),
      },
    );

    expect(snoozeRes.status).toBe(200);
    const snoozeData = await snoozeRes.json();
    expect(snoozeData.success).toBe(true);
    expect(snoozeData.data.status).toBe("snoozed");
    expect(new Date(snoozeData.data.snoozeUntil).getTime()).toBe(
      snoozeDate.getTime(),
    );
    expect(snoozeData.data.snoozeReason).toBe(
      "Manual pause for high-touch sales outreach",
    );

    // Verify Audit log was created in Tenant A
    await withTenant(orgA, mockDb, async () => {
      const logs = await dbStore.auditLogs.findMany();
      const snoozeLog = logs.find((l) => l.action === "membership_snoozed");
      expect(snoozeLog).toBeDefined();
      expect(snoozeLog?.recordId).toBe(membershipId);
      expect(snoozeLog?.changes.status.after).toBe("snoozed");
    });

    // 2. Tenant B cross-tenant snooze attempt -> 404
    const badSnoozeRes = await app.request(
      `/api/sequences/memberships/${membershipId}/snooze`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenTenantB}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          snoozeUntil: snoozeDate.toISOString(),
          reason: "Intruder attempt",
        }),
      },
    );
    expect(badSnoozeRes.status).toBe(404);

    // 3. Tenant B cross-tenant resume attempt -> 404
    const badResumeRes = await app.request(
      `/api/sequences/memberships/${membershipId}/resume`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenTenantB}`,
        },
      },
    );
    expect(badResumeRes.status).toBe(404);

    // 4. Resume via POST API (Tenant A)
    const resumeRes = await app.request(
      `/api/sequences/memberships/${membershipId}/resume`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenTenantA}`,
        },
      },
    );
    expect(resumeRes.status).toBe(200);
    const resumeData = await resumeRes.json();
    expect(resumeData.success).toBe(true);
    expect(resumeData.data.status).toBe("active");
    expect(resumeData.data.snoozeUntil).toBeNull();
    expect(resumeData.data.snoozeReason).toBeNull();

    // Verify Audit log for resume was created
    await withTenant(orgA, mockDb, async () => {
      const logs = await dbStore.auditLogs.findMany();
      const resumeLog = logs.find((l) => l.action === "membership_resumed");
      expect(resumeLog).toBeDefined();
      expect(resumeLog?.recordId).toBe(membershipId);
      expect(resumeLog?.changes.status.after).toBe("active");
    });
  });

  it("should skip snoozed memberships during background execution and auto-resume expired snoozes", async () => {
    let membershipId = "";
    let _leadId = "";

    await withTenant(orgA, mockDb, async () => {
      // Setup sequence, template, step, and lead
      const seq = await dbStore.marketingSequences.insert({
        orgId: orgA,
        name: "Auto-Resume Drip Journey",
        description: "B2B drip journey",
        status: "active",
      });

      const tpl = await dbStore.emailTemplates.insert({
        orgId: orgA,
        name: "Acme Sequence Welcome",
        subject: "Introduction",
        body: "Welcome to Acme!",
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
        email: "auto@snooze.com",
        company: "AutoSnooze Co",
      });
      _leadId = lead.id;

      // Enroll lead
      const membership = await enrollInSequence(
        dbStore,
        orgA,
        seq.id,
        "lead",
        lead.id,
      );
      membershipId = membership.id;

      // Snooze membership for 7 days into the future
      await dbStore.marketingSequenceMemberships.update(membershipId, {
        status: "snoozed",
        snoozeUntil: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
        snoozeReason: "Temporary hold",
      });
    });

    // Run scheduler right now -> should skip execution since it's snoozed
    await withTenant(orgA, mockDb, async () => {
      const processedCount = await executePendingSequenceSteps(dbStore);
      expect(processedCount).toBe(0);

      // Verify that no activities were created yet
      const activities = await dbStore.activities.findMany();
      expect(activities).toHaveLength(0);
    });

    // Manually set snoozeUntil to the past to simulate time passing
    const pastDate = new Date(Date.now() - 1000 * 60 * 5); // 5 minutes ago
    await withTenant(orgA, mockDb, async () => {
      await dbStore.marketingSequenceMemberships.update(membershipId, {
        snoozeUntil: pastDate,
      });
    });

    // Run scheduler now -> should auto-resume and process step 1!
    await withTenant(orgA, mockDb, async () => {
      const processedCount = await executePendingSequenceSteps(dbStore);
      expect(processedCount).toBe(1);

      // Verify membership transitioned to completed (since it has no more steps) and snooze details are cleared
      const membership =
        await dbStore.marketingSequenceMemberships.findOne(membershipId);
      expect(membership?.status).toBe("completed");
      expect(membership?.snoozeUntil).toBeNull();
      expect(membership?.snoozeReason).toBeNull();

      // Verify that an activity was created (which indicates email step execution completed!)
      const activities = await dbStore.activities.findMany();
      expect(activities).toHaveLength(1);
      expect(activities[0].subject).toContain("Introduction");

      // Verify audit logs for auto-resumption
      const logs = await dbStore.auditLogs.findMany();
      const autoResumeLog = logs.find((l) => l.action === "membership_resumed");
      expect(autoResumeLog).toBeDefined();
    });
  });
});
