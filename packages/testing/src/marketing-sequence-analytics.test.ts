import { createSessionToken } from "@crm/auth";
import { dbStore, mockDb, withTenant } from "@crm/db";
import { beforeEach, describe, expect, it } from "vitest";
import app from "../../../apps/api/src/index";

describe("Marketing Sequence Step Performance Analytics API Tests (Task 0180)", () => {
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

  it("should auto-generate email trackers and calculate step-level sequence analytics with strict tenant isolation", async () => {
    // 1. Setup Tenant A Data
    let seqId = "";
    let tplId = "";
    let lead1Id = "";
    let lead2Id = "";

    await withTenant(orgA, mockDb, async () => {
      // Create sequence
      const seq = await dbStore.marketingSequences.insert({
        orgId: orgA,
        name: "Welcome Journey",
        description: "Sequence for new signups",
        status: "active",
      });
      seqId = seq.id;

      // Create template
      const tpl = await dbStore.emailTemplates.insert({
        orgId: orgA,
        name: "Day 1 Welcome",
        subject: "Welcome to our product, {{lead.firstName}}!",
        body: "Hello! We are glad to have you.",
      });
      tplId = tpl.id;

      // Create step
      await dbStore.marketingSequenceSteps.insert({
        orgId: orgA,
        sequenceId: seqId,
        stepNumber: 1,
        delayDays: 0,
        templateId: tplId,
      });

      // Create leads
      const lead1 = await dbStore.leads.insert({
        orgId: orgA,
        ownerId: "user-a",
        status: "New",
        email: "alice@example.com",
        company: "Alice Corp",
        convertedAccountId: null,
        convertedContactId: null,
        custom: null,
      });
      lead1Id = lead1.id;

      const lead2 = await dbStore.leads.insert({
        orgId: orgA,
        ownerId: "user-a",
        status: "New",
        email: "bob@example.com",
        company: "Bob Corp",
        convertedAccountId: null,
        convertedContactId: null,
        custom: null,
      });
      lead2Id = lead2.id;
    });

    // 2. Enroll members via REST API
    const enrollRes1 = await app.request(`/api/sequences/${seqId}/enroll`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenTenantA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        recordType: "lead",
        recordId: lead1Id,
      }),
    });
    expect(enrollRes1.status).toBe(200);

    const enrollRes2 = await app.request(`/api/sequences/${seqId}/enroll`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenTenantA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        recordType: "lead",
        recordId: lead2Id,
      }),
    });
    expect(enrollRes2.status).toBe(200);

    // 3. Execute sequence steps via REST API
    const execRes = await app.request("/api/sequences/execute", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenTenantA}`,
      },
    });
    expect(execRes.status).toBe(200);
    const execData = await execRes.json();
    expect(execData.processedCount).toBe(2);

    // 4. Verify email trackers were auto-generated during sequence step execution
    await withTenant(orgA, mockDb, async () => {
      const trackers = await dbStore.emailTrackers.findMany();
      expect(trackers.length).toBe(2);
      expect(trackers[0].openCount).toBe(0);
      expect(trackers[0].clickCount).toBe(0);

      // Simulate open/click on Alice's email: 2 opens, 1 click
      await dbStore.emailTrackers.update(trackers[0].id, {
        openCount: 2,
        clickCount: 1,
      });

      // Simulate open on Bob's email: 1 open, 0 clicks
      await dbStore.emailTrackers.update(trackers[1].id, {
        openCount: 1,
        clickCount: 0,
      });
    });

    // 5. Retrieve sequence performance report via REST API
    const analyticsRes = await app.request(
      `/api/sequences/${seqId}/analytics`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${tokenTenantA}`,
        },
      },
    );
    expect(analyticsRes.status).toBe(200);
    const analyticsData = await analyticsRes.json();
    expect(analyticsData.success).toBe(true);

    const report = analyticsData.data;
    expect(report.sequenceId).toBe(seqId);
    expect(report.totalEnrolled).toBe(2);
    expect(report.statusCounts.active).toBe(0);
    expect(report.statusCounts.completed).toBe(2);

    // Overall metrics:
    // Total emails sent: 2
    // Total opens: 3 (2 + 1) -> 3 / 2 = 150.00%
    // Total clicks: 1 (1 + 0) -> 1 / 2 = 50.00%
    expect(report.overallOpenRate).toBe("150.00%");
    expect(report.overallClickRate).toBe("50.00%");

    // Step aggregates:
    expect(report.steps.length).toBe(1);
    const step1 = report.steps[0];
    expect(step1.stepNumber).toBe(1);
    expect(step1.sentCount).toBe(2);
    expect(step1.openCount).toBe(3);
    expect(step1.clickCount).toBe(1);
    expect(step1.openRate).toBe("150.00%");
    expect(step1.clickRate).toBe("50.00%");

    // 6. Strict Tenant Isolation (RLS Verification)
    // Tenant B requests Tenant A's sequence analytics -> expect 404 Sequence not found
    const badAnalyticsRes = await app.request(
      `/api/sequences/${seqId}/analytics`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${tokenTenantB}`,
        },
      },
    );
    expect(badAnalyticsRes.status).toBe(404);
  });
});
