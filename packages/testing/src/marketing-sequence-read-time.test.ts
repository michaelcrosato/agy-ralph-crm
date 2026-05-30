import { createSessionToken } from "@crm/auth";
import { dbStore, mockDb, withTenant } from "@crm/db";
import { beforeEach, describe, expect, it } from "vitest";
import { createTestApp } from "./_harness";

const app = createTestApp();

describe("Marketing Sequence Email Read Time Analytics & Scoring Tests (Task 0207)", () => {
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

  it("should track email read time events publicly, update tracker metrics, compile analytics, and enforce strict tenant RLS isolation", async () => {
    let seq1Id = "";
    let step1Id = "";
    let step2Id = "";
    let _lead1Id = "";
    let _lead2Id = "";

    // 1. Setup Tenant A Data
    await withTenant(orgA, mockDb, async () => {
      // Create Sequence
      const seq1 = await dbStore.marketingSequences.insert({
        orgId: orgA,
        name: "Acme Engagement Campaign",
        description: "Testing read time",
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
        name: "Feature Focus",
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
      _lead1Id = lead1.id;

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
      _lead2Id = lead2.id;

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
        subject: "Features Lead 1",
        body: "Feature details!",
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
        token: "read-token-1",
      });

      await dbStore.emailTrackers.insert({
        orgId: orgA,
        activityId: act2.id,
        token: "read-token-2",
      });

      await dbStore.emailTrackers.insert({
        orgId: orgA,
        activityId: act3.id,
        token: "read-token-3",
      });
    });

    // 2. Track read-times via public endpoint
    // Event 1 (Glanced: 1500ms)
    const res1 = await app.request(
      "/api/public/emails/track/read-time/read-token-1",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          durationMs: 1500,
        }),
      },
    );
    expect(res1.status).toBe(200);

    // Event 2 (Skimmed: 4500ms)
    const res2 = await app.request(
      "/api/public/emails/track/read-time/read-token-2",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          durationMs: 4500,
        }),
      },
    );
    expect(res2.status).toBe(200);

    // Event 3 (Read: 12000ms)
    const res3 = await app.request(
      "/api/public/emails/track/read-time/read-token-3",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          durationMs: 12000,
        }),
      },
    );
    expect(res3.status).toBe(200);

    // 3. Verify tracker metrics updates under Tenant A
    await withTenant(orgA, mockDb, async () => {
      const trackers = await dbStore.emailTrackers.findMany();
      expect(trackers).toHaveLength(3);

      const t1 = trackers.find((x) => x.token === "read-token-1");
      expect(t1?.totalReadTimeMs).toBe(1500);
      expect(t1?.lastReadClassification).toBe("glanced");

      const t2 = trackers.find((x) => x.token === "read-token-2");
      expect(t2?.totalReadTimeMs).toBe(4500);
      expect(t2?.lastReadClassification).toBe("skimmed");

      const t3 = trackers.find((x) => x.token === "read-token-3");
      expect(t3?.totalReadTimeMs).toBe(12000);
      expect(t3?.lastReadClassification).toBe("read");
    });

    // 4. Query analytics as Tenant A
    const resAnalytics = await app.request(
      `/api/sequences/${seq1Id}/read-time-analytics`,
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
    expect(data.totalGlanced).toBe(1);
    expect(data.totalSkimmed).toBe(1);
    expect(data.totalRead).toBe(1);
    // (1500 + 4500 + 12000) / 3 = 6000ms average
    expect(data.averageReadTimeMs).toBe(6000);

    // Performance Breakdown percentages
    expect(data.readTimeClassificationPerformance).toBeDefined();
    const glancedMetric = data.readTimeClassificationPerformance.find(
      // biome-ignore lint/suspicious/noExplicitAny: test typing
      (s: any) => s.classification === "glanced",
    );
    const skimmedMetric = data.readTimeClassificationPerformance.find(
      // biome-ignore lint/suspicious/noExplicitAny: test typing
      (s: any) => s.classification === "skimmed",
    );
    const readMetric = data.readTimeClassificationPerformance.find(
      // biome-ignore lint/suspicious/noExplicitAny: test typing
      (s: any) => s.classification === "read",
    );

    expect(glancedMetric.eventCount).toBe(1);
    expect(glancedMetric.percentage).toBe("33.3%");

    expect(skimmedMetric.eventCount).toBe(1);
    expect(skimmedMetric.percentage).toBe("33.3%");

    expect(readMetric.eventCount).toBe(1);
    expect(readMetric.percentage).toBe("33.3%");

    // Step read time stats
    expect(data.stepReadTimeStats).toHaveLength(2);
    const step1Stats = data.stepReadTimeStats.find(
      // biome-ignore lint/suspicious/noExplicitAny: test typing
      (s: any) => s.stepId === step1Id,
    );
    const step2Stats = data.stepReadTimeStats.find(
      // biome-ignore lint/suspicious/noExplicitAny: test typing
      (s: any) => s.stepId === step2Id,
    );

    expect(step1Stats).toBeDefined();
    expect(step1Stats.stepName).toBe("Intro Mail");
    expect(step1Stats.glancedCount).toBe(1);
    expect(step1Stats.skimmedCount).toBe(0);
    expect(step1Stats.readCount).toBe(1);

    expect(step2Stats).toBeDefined();
    expect(step2Stats.stepName).toBe("Feature Focus");
    expect(step2Stats.glancedCount).toBe(0);
    expect(step2Stats.skimmedCount).toBe(1);
    expect(step2Stats.readCount).toBe(0);

    // 5. Assert RLS isolation - Tenant B cannot query Tenant A's sequence analytics
    const resForbidden = await app.request(
      `/api/sequences/${seq1Id}/read-time-analytics`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${tokenTenantB}`,
        },
      },
    );
    expect(resForbidden.status).toBe(404);

    // 6. Assert RLS - Tenant B gets empty list if querying events from DB directly
    await withTenant(orgB, mockDb, async () => {
      const dbEvents = await dbStore.emailReadTimeEvents.findMany();
      expect(dbEvents).toHaveLength(0);
    });

    // 7. Assert RLS - Tenant A sees their logged events
    await withTenant(orgA, mockDb, async () => {
      const dbEvents = await dbStore.emailReadTimeEvents.findMany();
      expect(dbEvents).toHaveLength(3);
    });
  });
});
