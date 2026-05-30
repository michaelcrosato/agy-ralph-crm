import { createSessionToken } from "@crm/auth";
import { dbStore, mockDb, withTenant } from "@crm/db";
import { beforeEach, describe, expect, it } from "vitest";
import app from "../../../apps/api/src/index";

describe("Marketing Sequence Email Open Analytics Tests (Task 0204)", () => {
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

  it("should track granular email open events, parse device types, aggregate metrics, and enforce RLS boundaries", async () => {
    let seq1Id = "";
    let step1Id = "";
    let step2Id = "";

    // 1. Setup Tenant A Data
    await withTenant(orgA, mockDb, async () => {
      // Create Sequence
      const seq1 = await dbStore.marketingSequences.insert({
        orgId: orgA,
        name: "Acme Warmup Campaign",
        description: "Warming up leads",
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
        name: "Welcome Email",
      });
      step1Id = step1.id;

      const step2 = await dbStore.marketingSequenceSteps.insert({
        orgId: orgA,
        sequenceId: seq1.id,
        stepNumber: 2,
        delayDays: 2,
        templateId: "tpl-2",
        name: "Feature Spotlight",
      });
      step2Id = step2.id;

      // Create Leads
      const lead1 = await dbStore.leads.insert({
        orgId: orgA,
        ownerId: "user-a",
        status: "New",
        email: "lead1@example.com",
        company: "Acme Co",
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

      // Email activities (Step 1 and Step 2)
      // For lead1, step1 and step2 sent
      const act1 = await dbStore.activities.insert({
        orgId: orgA,
        creatorId: "user-a",
        type: "email",
        subject: "Welcome Lead 1",
        body: "Hello!",
        dueDate: null,
      });

      const act2 = await dbStore.activities.insert({
        orgId: orgA,
        creatorId: "user-a",
        type: "email",
        subject: "Features Lead 1",
        body: "Spotlight!",
        dueDate: null,
      });

      // For lead2, step 1 sent
      const act3 = await dbStore.activities.insert({
        orgId: orgA,
        creatorId: "user-a",
        type: "email",
        subject: "Welcome Lead 2",
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
      // Lead 1 welcome: track-token-1
      const _tracker1 = await dbStore.emailTrackers.insert({
        orgId: orgA,
        activityId: act1.id,
        token: "track-token-1",
      });

      // Lead 1 feature: track-token-2
      const _tracker2 = await dbStore.emailTrackers.insert({
        orgId: orgA,
        activityId: act2.id,
        token: "track-token-2",
      });

      // Lead 2 welcome: track-token-3
      const _tracker3 = await dbStore.emailTrackers.insert({
        orgId: orgA,
        activityId: act3.id,
        token: "track-token-3",
      });
    });

    // 2. Track open events publicly
    // Track open 1: Desktop open on tracker 1
    const resOpen1 = await app.request(
      "/api/public/emails/track/open/track-token-1",
      {
        method: "GET",
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.0.0 Safari/537.36",
          "X-Forwarded-For": "203.0.113.1",
        },
      },
    );
    expect(resOpen1.status).toBe(200);

    // Track open 2: Mobile open on tracker 1
    const resOpen2 = await app.request(
      "/api/public/emails/track/open/track-token-1",
      {
        method: "GET",
        headers: {
          "User-Agent":
            "Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1",
          "X-Forwarded-For": "203.0.113.2",
        },
      },
    );
    expect(resOpen2.status).toBe(200);

    // Track open 3: Tablet open on tracker 2
    const resOpen3 = await app.request(
      "/api/public/emails/track/open/track-token-2",
      {
        method: "GET",
        headers: {
          "User-Agent":
            "Mozilla/5.0 (iPad; CPU OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1",
          "X-Forwarded-For": "203.0.113.3",
        },
      },
    );
    expect(resOpen3.status).toBe(200);

    // Track open 4: Android Mobile open on tracker 3
    const resOpen4 = await app.request(
      "/api/public/emails/track/open/track-token-3",
      {
        method: "GET",
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Linux; Android 10; SM-A505F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.0.0 Mobile Safari/537.36",
          "X-Forwarded-For": "203.0.113.4",
        },
      },
    );
    expect(resOpen4.status).toBe(200);

    // 3. Setup Tenant B Data to verify absolute RLS isolation
    await withTenant(orgB, mockDb, async () => {
      const seqB = await dbStore.marketingSequences.insert({
        orgId: orgB,
        name: "Tenant B Sequence",
        description: "Sequence B",
        status: "active",
      });

      const _stepB = await dbStore.marketingSequenceSteps.insert({
        orgId: orgB,
        sequenceId: seqB.id,
        stepNumber: 1,
        delayDays: 0,
        templateId: "tpl-b",
        name: "Tenant B Step 1",
      });

      const leadB = await dbStore.leads.insert({
        orgId: orgB,
        ownerId: "user-b",
        status: "New",
        email: "leadb@example.com",
        company: "Client B",
        convertedAccountId: null,
        convertedContactId: null,
        custom: null,
      });

      await dbStore.marketingSequenceMemberships.insert({
        orgId: orgB,
        sequenceId: seqB.id,
        recordType: "lead",
        recordId: leadB.id,
        status: "active",
        currentStepNumber: 1,
      });

      const actB = await dbStore.activities.insert({
        orgId: orgB,
        creatorId: "user-b",
        type: "email",
        subject: "Subject B",
        body: "Body B",
        dueDate: null,
      });

      await dbStore.activityLinks.insert({
        orgId: orgB,
        activityId: actB.id,
        targetType: "Lead",
        targetId: leadB.id,
      });

      const _trackerB = await dbStore.emailTrackers.insert({
        orgId: orgB,
        activityId: actB.id,
        token: "track-token-b",
      });
    });

    // Track open on Tenant B tracker to ensure it does not leak into Tenant A's analytics
    const resOpenB = await app.request(
      "/api/public/emails/track/open/track-token-b",
      {
        method: "GET",
        headers: {
          "User-Agent":
            "Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1",
          "X-Forwarded-For": "203.0.113.9",
        },
      },
    );
    expect(resOpenB.status).toBe(200);

    // 4. Request Opens Analytics as Tenant A
    const resA = await app.request(`/api/sequences/${seq1Id}/opens-analytics`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${tokenTenantA}`,
      },
    });

    expect(resA.status).toBe(200);
    const bodyA = await resA.json();
    expect(bodyA.success).toBe(true);

    const dataA = bodyA.data;
    expect(dataA.totalTrackedOpens).toBe(4); // 2 on tracker1 (step 1), 1 on tracker2 (step 2), 1 on tracker3 (step 1)
    expect(dataA.totalUniqueOpens).toBe(3); // tracker1, tracker2, tracker3 all opened at least once

    // Check Device Performance Breakdown
    expect(dataA.devicePerformance.length).toBe(3); // mobile, desktop, tablet
    const perfMobile = dataA.devicePerformance.find(
      (d: { deviceType: string }) => d.deviceType === "mobile",
    );
    const perfDesktop = dataA.devicePerformance.find(
      (d: { deviceType: string }) => d.deviceType === "desktop",
    );
    const perfTablet = dataA.devicePerformance.find(
      (d: { deviceType: string }) => d.deviceType === "tablet",
    );

    expect(perfMobile).toBeDefined();
    expect(perfMobile.openCount).toBe(2); // iPhone, Android
    expect(perfMobile.percentage).toBe("50.0%");

    expect(perfDesktop).toBeDefined();
    expect(perfDesktop.openCount).toBe(1); // Chrome/Mac
    expect(perfDesktop.percentage).toBe("25.0%");

    expect(perfTablet).toBeDefined();
    expect(perfTablet.openCount).toBe(1); // iPad
    expect(perfTablet.percentage).toBe("25.0%");

    // Check Step-level open rates
    expect(dataA.stepOpenRates.length).toBe(2);
    const rateStep1 = dataA.stepOpenRates.find(
      (s: { stepId: string }) => s.stepId === step1Id,
    );
    const rateStep2 = dataA.stepOpenRates.find(
      (s: { stepId: string }) => s.stepId === step2Id,
    );

    expect(rateStep1).toBeDefined();
    expect(rateStep1.stepName).toBe("Welcome Email");
    expect(rateStep1.totalSent).toBe(2); // tracker1 and tracker3
    expect(rateStep1.uniqueOpens).toBe(2); // both tracker1 and tracker3 opened
    expect(rateStep1.openRate).toBe("100.0%");

    expect(rateStep2).toBeDefined();
    expect(rateStep2.stepName).toBe("Feature Spotlight");
    expect(rateStep2.totalSent).toBe(1); // tracker2
    expect(rateStep2.uniqueOpens).toBe(1); // tracker2 opened
    expect(rateStep2.openRate).toBe("100.0%");

    // 5. Verification of RLS Isolation - Tenant B requesting Tenant A's Sequence open analytics
    const resB = await app.request(`/api/sequences/${seq1Id}/opens-analytics`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${tokenTenantB}`,
      },
    });

    expect(resB.status).toBe(404); // Tenant B cannot see Tenant A's sequence
  });
});
