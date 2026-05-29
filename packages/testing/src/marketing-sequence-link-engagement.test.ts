import { createSessionToken } from "@crm/auth";
import { dbStore, mockDb, withTenant } from "@crm/db";
import { beforeEach, describe, expect, it } from "vitest";
import app from "../../../apps/api/src/index";

describe("Marketing Sequence Link Engagement Analytics Tests (Task 0203)", () => {
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

  it("should calculate correct unique clicked link analytics by step and enforce strict tenant RLS isolation", async () => {
    let seq1Id = "";
    let step1Id = "";
    let step2Id = "";

    // 1. Setup Tenant A Data
    await withTenant(orgA, mockDb, async () => {
      // Create Sequence
      const seq1 = await dbStore.marketingSequences.insert({
        orgId: orgA,
        name: "Acme Engagement Sequence",
        description: "Engaging prospects",
        status: "active",
      });
      seq1Id = seq1.id;

      // Create steps
      const step1 = await dbStore.marketingSequenceSteps.insert({
        orgId: orgA,
        sequenceId: seq1.id,
        stepNumber: 1,
        delayDays: 0,
        templateId: "tpl-1",
        name: "Introductory Pitch",
      });
      step1Id = step1.id;

      const step2 = await dbStore.marketingSequenceSteps.insert({
        orgId: orgA,
        sequenceId: seq1.id,
        stepNumber: 2,
        delayDays: 3,
        templateId: "tpl-2",
        name: "Follow-up Details",
      });
      step2Id = step2.id;

      // Create Lead
      const lead1 = await dbStore.leads.insert({
        orgId: orgA,
        ownerId: "user-a",
        status: "New",
        email: "prospect@example.com",
        company: "Acme Client Corp",
        convertedAccountId: null,
        convertedContactId: null,
        custom: null,
      });

      // Sequence membership
      await dbStore.marketingSequenceMemberships.insert({
        orgId: orgA,
        sequenceId: seq1.id,
        recordType: "lead",
        recordId: lead1.id,
        status: "active",
        currentStepNumber: 2,
        nextExecutionAt: new Date(),
      });

      // Email activities (Step 1 and Step 2)
      const act1 = await dbStore.activities.insert({
        orgId: orgA,
        creatorId: "user-a",
        type: "email",
        subject: "Intro Pitch",
        body: "Hello! Check out our features.",
        dueDate: null,
      });

      const act2 = await dbStore.activities.insert({
        orgId: orgA,
        creatorId: "user-a",
        type: "email",
        subject: "Pricing Options",
        body: "Hello! Here is the pricing details.",
        dueDate: null,
      });

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

      // Trackers
      const sortedActs = [act1, act2].sort((a, b) => a.id.localeCompare(b.id));

      const tracker1 = await dbStore.emailTrackers.insert({
        orgId: orgA,
        activityId: sortedActs[0].id,
        token: "track-token-1",
      });

      const tracker2 = await dbStore.emailTrackers.insert({
        orgId: orgA,
        activityId: sortedActs[1].id,
        token: "track-token-2",
      });

      // Click Events
      await dbStore.emailClickEvents.insert({
        orgId: orgA,
        trackerId: tracker1.id,
        clickedUrl: "https://example.com/demo",
        ipAddress: "127.0.0.1",
        userAgent: "Chrome",
      });

      await dbStore.emailClickEvents.insert({
        orgId: orgA,
        trackerId: tracker1.id,
        clickedUrl: "https://example.com/demo",
        ipAddress: "127.0.0.1",
        userAgent: "Chrome",
      });

      await dbStore.emailClickEvents.insert({
        orgId: orgA,
        trackerId: tracker2.id,
        clickedUrl: "https://example.com/pricing",
        ipAddress: "127.0.0.1",
        userAgent: "Chrome",
      });
    });

    // 2. Setup Tenant B Data to verify absolute RLS isolation
    await withTenant(orgB, mockDb, async () => {
      const seqB = await dbStore.marketingSequences.insert({
        orgId: orgB,
        name: "Tenant B Sequence",
        description: "Sequence B",
        status: "active",
      });

      const stepB = await dbStore.marketingSequenceSteps.insert({
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
        nextExecutionAt: new Date(),
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

      const trackerB = await dbStore.emailTrackers.insert({
        orgId: orgB,
        activityId: actB.id,
        token: "track-token-b",
      });

      await dbStore.emailClickEvents.insert({
        orgId: orgB,
        trackerId: trackerB.id,
        clickedUrl: "https://example.com/cross-tenant",
        ipAddress: "127.0.0.1",
        userAgent: "Chrome",
      });
    });

    // 3. Request Link Engagement Analytics as Tenant A
    const resA = await app.request(`/api/sequences/${seq1Id}/links-analytics`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${tokenTenantA}`,
      },
    });

    expect(resA.status).toBe(200);
    const bodyA = await resA.json();
    expect(bodyA.success).toBe(true);

    const dataA = bodyA.data;
    expect(dataA.totalTrackedClicks).toBe(3); // 2 on step1, 1 on step2

    expect(dataA.linkPerformance.length).toBe(2);

    // Sort or check both performance entries
    const perfDemo = dataA.linkPerformance.find(
      (p: { clickedUrl: string }) =>
        p.clickedUrl === "https://example.com/demo",
    );
    const perfPricing = dataA.linkPerformance.find(
      (p: { clickedUrl: string }) =>
        p.clickedUrl === "https://example.com/pricing",
    );

    expect(perfDemo).toBeDefined();
    expect(perfDemo.stepId).toBe(step1Id);
    expect(perfDemo.stepName).toBe("Introductory Pitch");
    expect(perfDemo.clickCount).toBe(2);
    expect(perfDemo.percentage).toBe("66.7%");

    expect(perfPricing).toBeDefined();
    expect(perfPricing.stepId).toBe(step2Id);
    expect(perfPricing.stepName).toBe("Follow-up Details");
    expect(perfPricing.clickCount).toBe(1);
    expect(perfPricing.percentage).toBe("33.3%");

    // 4. Verification of RLS Isolation - Tenant B requesting Tenant A's Sequence link analytics
    const resB = await app.request(`/api/sequences/${seq1Id}/links-analytics`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${tokenTenantB}`,
      },
    });

    expect(resB.status).toBe(404); // Tenant B cannot find/see Tenant A's sequence
  });
});
