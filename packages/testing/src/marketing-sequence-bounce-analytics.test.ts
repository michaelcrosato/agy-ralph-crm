import { createSessionToken } from "@crm/auth";
import { dbStore, mockDb, withTenant } from "@crm/db";
import { beforeEach, describe, expect, it } from "vitest";
import app from "../../../apps/api/src/index";

describe("Marketing Sequence Email Bounce Analytics Tests (Task 0206)", () => {
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

    await withTenant(orgA, mockDb, async () => {
      await dbStore.memberships.insert({
        orgId: orgA,
        userId: "user-a",
        roleId: "role-a",
      });
    });

    await withTenant(orgB, mockDb, async () => {
      await dbStore.memberships.insert({
        orgId: orgB,
        userId: "user-b",
        roleId: "role-b",
      });
    });
  });

  it("should track granular email bounce and complaint events, update suppressions/memberships, compute analytics, and enforce RLS isolation", async () => {
    let seq1Id = "";
    let step1Id = "";
    let step2Id = "";
    let lead1Id = "";
    let lead2Id = "";

    // 1. Setup Tenant A Data
    await withTenant(orgA, mockDb, async () => {
      // Create Sequence
      const seq1 = await dbStore.marketingSequences.insert({
        orgId: orgA,
        name: "Acme Bounce Campaign",
        description: "Testing bounces",
        status: "active",
      });
      seq1Id = seq1.id;

      // Create sequence steps
      const step1 = await dbStore.marketingSequenceSteps.insert({
        orgId: orgA,
        sequenceId: seq1.id,
        stepNumber: 1,
        delayDays: 0,
        templateId: "tpl-1",
        name: "Intro Mail",
      });
      step1Id = step1.id;

      const step2 = await dbStore.marketingSequenceSteps.insert({
        orgId: orgA,
        sequenceId: seq1.id,
        stepNumber: 2,
        delayDays: 2,
        templateId: "tpl-2",
        name: "Follow up Spotlight",
      });
      step2Id = step2.id;

      // Create Leads
      const lead1 = await dbStore.leads.insert({
        orgId: orgA,
        ownerId: "user-a",
        status: "New",
        email: "lead1@example.com",
        company: "Alpha Corp",
        convertedAccountId: null,
        convertedContactId: null,
        custom: null,
      });
      lead1Id = lead1.id;

      const lead2 = await dbStore.leads.insert({
        orgId: orgA,
        ownerId: "user-a",
        status: "New",
        email: "lead2@example.com",
        company: "Beta Corp",
        convertedAccountId: null,
        convertedContactId: null,
        custom: null,
      });
      lead2Id = lead2.id;

      // Memberships
      await dbStore.marketingSequenceMemberships.insert({
        orgId: orgA,
        sequenceId: seq1.id,
        recordType: "lead",
        recordId: lead1.id,
        status: "active",
        currentStepNumber: 2,
      });

      await dbStore.marketingSequenceMemberships.insert({
        orgId: orgA,
        sequenceId: seq1.id,
        recordType: "lead",
        recordId: lead2.id,
        status: "active",
        currentStepNumber: 1,
      });

      // Email activities
      const act1 = await dbStore.activities.insert({
        orgId: orgA,
        creatorId: "user-a",
        type: "email",
        subject: "Intro Lead 1",
        body: "Hello!",
        dueDate: null,
      });

      const act2 = await dbStore.activities.insert({
        orgId: orgA,
        creatorId: "user-a",
        type: "email",
        subject: "Followup Lead 1",
        body: "Spotlight!",
        dueDate: null,
      });

      const act3 = await dbStore.activities.insert({
        orgId: orgA,
        creatorId: "user-a",
        type: "email",
        subject: "Intro Lead 2",
        body: "Hello!",
        dueDate: null,
      });

      // Link activities to leads
      await dbStore.activityLinks.insert({
        orgId: orgA,
        activityId: act1.id,
        targetType: "Lead",
        targetId: lead1.id,
      });

      await dbStore.activityLinks.insert({
        orgId: orgA,
        activityId: act2.id,
        targetType: "Lead",
        targetId: lead1.id,
      });

      await dbStore.activityLinks.insert({
        orgId: orgA,
        activityId: act3.id,
        targetType: "Lead",
        targetId: lead2.id,
      });

      // Trackers
      await dbStore.emailTrackers.insert({
        orgId: orgA,
        activityId: act1.id,
        token: "bounce-token-1",
      });

      await dbStore.emailTrackers.insert({
        orgId: orgA,
        activityId: act2.id,
        token: "bounce-token-2",
      });

      await dbStore.emailTrackers.insert({
        orgId: orgA,
        activityId: act3.id,
        token: "bounce-token-3",
      });
    });

    // 2. Track bounces via public endpoint
    // Bounce 1 (Hard Bounce)
    const res1 = await app.request(
      "/api/public/emails/track/bounce/bounce-token-1",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventType: "bounce",
          bounceType: "hard",
          bounceReason: "550 User Unknown",
        }),
      },
    );
    expect(res1.status).toBe(200);

    // Bounce 2 (Spam Complaint)
    const res2 = await app.request(
      "/api/public/emails/track/bounce/bounce-token-2",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventType: "complaint",
          bounceReason: "Spam complaint reported",
        }),
      },
    );
    expect(res2.status).toBe(200);

    // Bounce 3 (Soft Bounce)
    const res3 = await app.request(
      "/api/public/emails/track/bounce/bounce-token-3",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventType: "bounce",
          bounceType: "soft",
          bounceReason: "Mailbox Full",
        }),
      },
    );
    expect(res3.status).toBe(200);

    // 3. Verify suppression and membership updates under Tenant A
    await withTenant(orgA, mockDb, async () => {
      // Bounces lead to suppression records
      const suppressions =
        await dbStore.marketingSequenceSuppressions.findMany();
      expect(suppressions.length).toBeGreaterThanOrEqual(3);

      // Verify sequence memberships exited
      const memberships = await dbStore.marketingSequenceMemberships.findMany();
      const seqMemberships = memberships.filter((m) => m.sequenceId === seq1Id);
      for (const m of seqMemberships) {
        expect(m.status).toBe("exited");
      }

      // Verify Lead custom fields updated
      const lead1 = await dbStore.leads.findOne(lead1Id);
      expect(lead1).toBeDefined();
      expect(lead1?.custom).toBeDefined();
      expect(lead1?.custom?.email_status).toBe("complained"); // Last update wins

      const lead2 = await dbStore.leads.findOne(lead2Id);
      expect(lead2).toBeDefined();
      expect(lead2?.custom).toBeDefined();
      expect(lead2?.custom?.email_status).toBe("bounced");
    });

    // 4. Query analytics as Tenant A
    const resAnalytics = await app.request(
      `/api/sequences/${seq1Id}/bounces-analytics`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${tokenTenantA}`,
        },
      },
    );
    expect(resAnalytics.status).toBe(200);
    const analytics = await resAnalytics.json();
    expect(analytics.success).toBe(true);

    const data = analytics.data;
    expect(data.totalBounces).toBe(2);
    expect(data.totalComplaints).toBe(1);
    expect(data.totalUniqueBouncedTrackers).toBe(3);
    // 3 sent globally, 3 bounced -> 100% bounce rate
    expect(data.bounceRate).toBe("100.0%");

    // Bounce Type Performance breakdown
    expect(data.bounceTypePerformance).toBeDefined();
    const hard = data.bounceTypePerformance.find(
      // biome-ignore lint/suspicious/noExplicitAny: test typing
      (s: any) => s.bounceType === "hard",
    );
    const soft = data.bounceTypePerformance.find(
      // biome-ignore lint/suspicious/noExplicitAny: test typing
      (s: any) => s.bounceType === "soft",
    );
    const complaint = data.bounceTypePerformance.find(
      // biome-ignore lint/suspicious/noExplicitAny: test typing
      (s: any) => s.bounceType === "spam_complaint",
    );

    expect(hard).toBeDefined();
    expect(hard.eventCount).toBe(1);
    expect(hard.percentage).toBe("33.3%");

    expect(soft).toBeDefined();
    expect(soft.eventCount).toBe(1);
    expect(soft.percentage).toBe("33.3%");

    expect(complaint).toBeDefined();
    expect(complaint.eventCount).toBe(1);
    expect(complaint.percentage).toBe("33.3%");

    // Step bounce rates
    expect(data.stepBounceRates).toHaveLength(2);
    const step1Metric = data.stepBounceRates.find(
      // biome-ignore lint/suspicious/noExplicitAny: test typing
      (s: any) => s.stepId === step1Id,
    );
    const step2Metric = data.stepBounceRates.find(
      // biome-ignore lint/suspicious/noExplicitAny: test typing
      (s: any) => s.stepId === step2Id,
    );

    expect(step1Metric).toBeDefined();
    expect(step1Metric.stepName).toBe("Intro Mail");
    expect(step1Metric.totalSent).toBe(2);
    expect(step1Metric.uniqueBounces).toBe(2);
    expect(step1Metric.bounceRate).toBe("100.0%");

    expect(step2Metric).toBeDefined();
    expect(step2Metric.stepName).toBe("Follow up Spotlight");
    expect(step2Metric.totalSent).toBe(1);
    expect(step2Metric.uniqueBounces).toBe(1);
    expect(step2Metric.bounceRate).toBe("100.0%");

    // 5. Assert RLS isolation - Tenant B cannot query Tenant A's sequence analytics
    const resForbidden = await app.request(
      `/api/sequences/${seq1Id}/bounces-analytics`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${tokenTenantB}`,
        },
      },
    );
    expect(resForbidden.status).toBe(404);

    // 6. Assert RLS - Tenant B gets empty list if querying bounce events from DB directly
    await withTenant(orgB, mockDb, async () => {
      const dbBounces = await dbStore.emailBounceEvents.findMany();
      expect(dbBounces).toHaveLength(0);
    });

    // 7. Assert RLS - Tenant A sees their logged events
    await withTenant(orgA, mockDb, async () => {
      const dbBounces = await dbStore.emailBounceEvents.findMany();
      expect(dbBounces).toHaveLength(3);
    });
  });
});
