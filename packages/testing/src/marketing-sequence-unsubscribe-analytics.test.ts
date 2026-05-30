import { createSessionToken } from "@crm/auth";
import { dbStore, mockDb, withTenant } from "@crm/db";
import { beforeEach, describe, expect, it } from "vitest";
import { createTestApp } from "./_harness";

const app = createTestApp();

describe("Marketing Sequence Unsubscribe Analytics Tests (Task 0202)", () => {
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

  it("should calculate correct unsubscribe reasons analytics and enforce strict tenant RLS isolation", async () => {
    // 1. Setup Tenant A Data
    await withTenant(orgA, mockDb, async () => {
      // Create a couple of sequences
      const seq1 = await dbStore.marketingSequences.insert({
        orgId: orgA,
        name: "Acme Welcome Sequence",
        description: "Sequence 1",
        status: "active",
      });

      const seq2 = await dbStore.marketingSequences.insert({
        orgId: orgA,
        name: "Acme Nurture Sequence",
        description: "Sequence 2",
        status: "active",
      });

      // Create Leads
      const lead1 = await dbStore.leads.insert({
        orgId: orgA,
        ownerId: "user-a",
        status: "New",
        email: "lead1@example.com",
        company: "Example Corp A1",
        convertedAccountId: null,
        convertedContactId: null,
        custom: null,
      });

      const lead2 = await dbStore.leads.insert({
        orgId: orgA,
        ownerId: "user-a",
        status: "New",
        email: "lead2@example.com",
        company: "Example Corp A2",
        convertedAccountId: null,
        convertedContactId: null,
        custom: null,
      });

      // Create Sequence Memberships
      await dbStore.marketingSequenceMemberships.insert({
        orgId: orgA,
        sequenceId: seq1.id,
        recordType: "lead",
        recordId: lead1.id,
        status: "unsubscribed",
        currentStepNumber: 1,
        nextExecutionAt: new Date(),
      });

      await dbStore.marketingSequenceMemberships.insert({
        orgId: orgA,
        sequenceId: seq2.id,
        recordType: "lead",
        recordId: lead2.id,
        status: "unsubscribed",
        currentStepNumber: 1,
        nextExecutionAt: new Date(),
      });

      // Create Email Activities and Links
      const act1 = await dbStore.activities.insert({
        orgId: orgA,
        creatorId: "user-a",
        type: "email",
        subject: "Welcome Step 1",
        body: "Hello!",
        dueDate: null,
      });

      await dbStore.activityLinks.insert({
        orgId: orgA,
        activityId: act1.id,
        targetType: "Lead",
        targetId: lead1.id,
      });

      const act2 = await dbStore.activities.insert({
        orgId: orgA,
        creatorId: "user-a",
        type: "email",
        subject: "Nurture Step 1",
        body: "Hello nurture!",
        dueDate: null,
      });

      await dbStore.activityLinks.insert({
        orgId: orgA,
        activityId: act2.id,
        targetType: "Lead",
        targetId: lead2.id,
      });

      // Create Email Trackers
      const tracker1 = await dbStore.emailTrackers.insert({
        orgId: orgA,
        activityId: act1.id,
        token: "token-1",
      });

      const tracker2 = await dbStore.emailTrackers.insert({
        orgId: orgA,
        activityId: act2.id,
        token: "token-2",
      });

      // Log Unsubscribe Reasons
      await dbStore.emailUnsubscribes.insert({
        orgId: orgA,
        trackerId: tracker1.id,
        reason: "frequency",
        feedback: "Way too many emails!",
      });

      await dbStore.emailUnsubscribes.insert({
        orgId: orgA,
        trackerId: tracker2.id,
        reason: "relevance",
        feedback: "Not relevant anymore.",
      });

      await dbStore.emailUnsubscribes.insert({
        orgId: orgA,
        trackerId: tracker2.id,
        reason: "frequency",
        feedback: "Spamming my inbox.",
      });
    });

    // 2. Setup Tenant B Data (to ensure it is NOT mixed into Tenant A's results)
    await withTenant(orgB, mockDb, async () => {
      const seqB = await dbStore.marketingSequences.insert({
        orgId: orgB,
        name: "Tenant B Outbound Sequence",
        description: "Tenant B Sequence",
        status: "active",
      });

      const leadB = await dbStore.leads.insert({
        orgId: orgB,
        ownerId: "user-b",
        status: "New",
        email: "leadB@example.com",
        company: "Example Corp B",
        convertedAccountId: null,
        convertedContactId: null,
        custom: null,
      });

      await dbStore.marketingSequenceMemberships.insert({
        orgId: orgB,
        sequenceId: seqB.id,
        recordType: "lead",
        recordId: leadB.id,
        status: "unsubscribed",
        currentStepNumber: 1,
        nextExecutionAt: new Date(),
      });

      const actB = await dbStore.activities.insert({
        orgId: orgB,
        creatorId: "user-b",
        type: "email",
        subject: "Outbound Step 1",
        body: "Tenant B email",
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
        token: "token-b",
      });

      await dbStore.emailUnsubscribes.insert({
        orgId: orgB,
        trackerId: trackerB.id,
        reason: "not_requested",
        feedback: "Didn't ask for this.",
      });
    });

    // 3. Query the analytics API as Tenant A
    const resA = await app.request("/api/unsubscribes/analytics", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${tokenTenantA}`,
      },
    });

    expect(resA.status).toBe(200);
    const bodyA = await resA.json();
    expect(bodyA.success).toBe(true);

    const dataA = bodyA.data;
    expect(dataA.totalUnsubscribes).toBe(3);

    // Verify reason breakdown for Tenant A
    const freq = dataA.reasonBreakdown.find(
      (r: { reason: string }) => r.reason === "frequency",
    );
    const rel = dataA.reasonBreakdown.find(
      (r: { reason: string }) => r.reason === "relevance",
    );
    const notReq = dataA.reasonBreakdown.find(
      (r: { reason: string }) => r.reason === "not_requested",
    );

    expect(freq.count).toBe(2);
    expect(freq.percentage).toBe("66.7%");
    expect(rel.count).toBe(1);
    expect(rel.percentage).toBe("33.3%");
    expect(notReq.count).toBe(0);
    expect(notReq.percentage).toBe("0.0%");

    // Verify sequence breakdown for Tenant A
    const welcomeSeq = dataA.sequenceBreakdown.find(
      (s: { sequenceName: string }) =>
        s.sequenceName === "Acme Welcome Sequence",
    );
    const nurtureSeq = dataA.sequenceBreakdown.find(
      (s: { sequenceName: string }) =>
        s.sequenceName === "Acme Nurture Sequence",
    );
    const bSeq = dataA.sequenceBreakdown.find((s: { sequenceName: string }) =>
      s.sequenceName.includes("Tenant B"),
    );

    expect(welcomeSeq.count).toBe(1);
    expect(welcomeSeq.percentage).toBe("33.3%");
    expect(nurtureSeq.count).toBe(2);
    expect(nurtureSeq.percentage).toBe("66.7%");
    expect(bSeq).toBeUndefined(); // Tenant B's sequences must not appear!

    // 4. Query the analytics API as Tenant B
    const resB = await app.request("/api/unsubscribes/analytics", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${tokenTenantB}`,
      },
    });

    expect(resB.status).toBe(200);
    const bodyB = await resB.json();
    expect(bodyB.success).toBe(true);

    const dataB = bodyB.data;
    expect(dataB.totalUnsubscribes).toBe(1);

    const notReqB = dataB.reasonBreakdown.find(
      (r: { reason: string }) => r.reason === "not_requested",
    );
    expect(notReqB.count).toBe(1);
    expect(notReqB.percentage).toBe("100.0%");

    const bSeqB = dataB.sequenceBreakdown.find(
      (s: { sequenceName: string }) =>
        s.sequenceName === "Tenant B Outbound Sequence",
    );
    expect(bSeqB.count).toBe(1);
    expect(bSeqB.percentage).toBe("100.0%");
  });
});
