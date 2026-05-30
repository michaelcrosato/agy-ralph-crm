import { createSessionToken } from "@crm/auth";
import { dbStore, mockDb, withTenant } from "@crm/db";
import { beforeEach, describe, expect, it } from "vitest";
import { createTestApp } from "./_harness";

const app = createTestApp();

describe("Marketing Sequence Email Reply Analytics Tests (Task 0205)", () => {
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

  it("should track granular email reply events, parse sentiment, aggregate analytics, and enforce RLS tenant isolation", async () => {
    let seq1Id = "";
    let step1Id = "";
    let step2Id = "";

    // 1. Setup Tenant A Data
    await withTenant(orgA, mockDb, async () => {
      // Create Sequence
      const seq1 = await dbStore.marketingSequences.insert({
        orgId: orgA,
        name: "Acme Reply Campaign",
        description: "Testing replies",
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
        token: "track-token-1",
      });

      await dbStore.emailTrackers.insert({
        orgId: orgA,
        activityId: act2.id,
        token: "track-token-2",
      });

      await dbStore.emailTrackers.insert({
        orgId: orgA,
        activityId: act3.id,
        token: "track-token-3",
      });
    });

    // 2. Track replies via public endpoint
    // Reply 1 (Positive)
    const res1 = await app.request(
      "/api/public/emails/track/reply/track-token-1",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          replyBody: "Yes please, this sounds great!",
          senderEmail: "lead1@example.com",
        }),
      },
    );
    expect(res1.status).toBe(200);

    // Reply 2 (Negative)
    const res2 = await app.request(
      "/api/public/emails/track/reply/track-token-2",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          replyBody: "No thank you, please unsubscribe me.",
          senderEmail: "lead1@example.com",
        }),
      },
    );
    expect(res2.status).toBe(200);

    // Reply 3 (Neutral)
    const res3 = await app.request(
      "/api/public/emails/track/reply/track-token-3",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          replyBody: "I got your message.",
          senderEmail: "lead2@example.com",
        }),
      },
    );
    expect(res3.status).toBe(200);

    // 3. Query analytics as Tenant A
    const resAnalytics = await app.request(
      `/api/sequences/${seq1Id}/replies-analytics`,
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
    expect(data.totalTrackedReplies).toBe(3);
    expect(data.totalUniqueReplies).toBe(3);
    // 3 sent globally, 3 replied -> 100% reply rate
    expect(data.replyRate).toBe("100.0%");

    // Sentiment breakdown
    expect(data.sentimentPerformance).toBeDefined();
    const positive = data.sentimentPerformance.find(
      // biome-ignore lint/suspicious/noExplicitAny: test typing
      (s: any) => s.sentiment === "positive",
    );
    const negative = data.sentimentPerformance.find(
      // biome-ignore lint/suspicious/noExplicitAny: test typing
      (s: any) => s.sentiment === "negative",
    );
    const neutral = data.sentimentPerformance.find(
      // biome-ignore lint/suspicious/noExplicitAny: test typing
      (s: any) => s.sentiment === "neutral",
    );

    expect(positive).toBeDefined();
    expect(positive.replyCount).toBe(1);
    expect(positive.percentage).toBe("33.3%");

    expect(negative).toBeDefined();
    expect(negative.replyCount).toBe(1);
    expect(negative.percentage).toBe("33.3%");

    expect(neutral).toBeDefined();
    expect(neutral.replyCount).toBe(1);
    expect(neutral.percentage).toBe("33.3%");

    // Step reply rates
    expect(data.stepReplyRates).toHaveLength(2);
    const step1Metric = data.stepReplyRates.find(
      // biome-ignore lint/suspicious/noExplicitAny: test typing
      (s: any) => s.stepId === step1Id,
    );
    const step2Metric = data.stepReplyRates.find(
      // biome-ignore lint/suspicious/noExplicitAny: test typing
      (s: any) => s.stepId === step2Id,
    );

    expect(step1Metric).toBeDefined();
    expect(step1Metric.stepName).toBe("Intro Mail");
    // Intro sent to lead1 and lead2 (totalSent = 2)
    // Both replied (tracker 1 and tracker 3) -> uniqueReplies = 2
    expect(step1Metric.totalSent).toBe(2);
    expect(step1Metric.uniqueReplies).toBe(2);
    expect(step1Metric.replyRate).toBe("100.0%");

    expect(step2Metric).toBeDefined();
    expect(step2Metric.stepName).toBe("Follow up Spotlight");
    // Spotlight sent to lead1 (totalSent = 1)
    // Lead 1 replied (tracker 2) -> uniqueReplies = 1
    expect(step2Metric.totalSent).toBe(1);
    expect(step2Metric.uniqueReplies).toBe(1);
    expect(step2Metric.replyRate).toBe("100.0%");

    // 4. Assert RLS isolation - Tenant B cannot query Tenant A's sequence analytics
    const resForbidden = await app.request(
      `/api/sequences/${seq1Id}/replies-analytics`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${tokenTenantB}`,
        },
      },
    );
    // Tenant B gets 404 because the sequence is not found for B
    expect(resForbidden.status).toBe(404);

    // 5. Assert RLS - Tenant B gets empty list if querying replies from DB directly
    await withTenant(orgB, mockDb, async () => {
      const dbReplies = await dbStore.emailReplyEvents.findMany();
      expect(dbReplies).toHaveLength(0);
    });

    // 6. Assert RLS - Tenant A sees their logged events
    await withTenant(orgA, mockDb, async () => {
      const dbReplies = await dbStore.emailReplyEvents.findMany();
      expect(dbReplies).toHaveLength(3);
    });
  });
});
