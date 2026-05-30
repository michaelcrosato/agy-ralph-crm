import { createSessionToken } from "@crm/auth";
import { executePendingSequenceSteps } from "@crm/core";
import { dbStore, mockDb, withTenant } from "@crm/db";
import { beforeEach, describe, expect, it } from "vitest";

describe("Marketing Sequence Recipient Time-Zone Smart Delivery Engine Tests (Task 0189)", () => {
  let _tokenTenantA: string;
  let _tokenTenantB: string;

  const orgA = "org-tenant-a";
  const orgB = "org-tenant-b";

  beforeEach(async () => {
    dbStore.clear();

    _tokenTenantA = await createSessionToken({
      userId: "user-a",
      orgId: orgA,
      roleId: "role-a",
      permissionsMask: 7,
    });

    _tokenTenantB = await createSessionToken({
      userId: "user-b",
      orgId: orgB,
      roleId: "role-b",
      permissionsMask: 7,
    });
  });

  it("should process timezone-aware scheduling and defer sequence steps correctly", async () => {
    let _leadTokyoId = "";
    let _leadNewYorkId = "";
    let _sequenceId = "";
    let _stepId = "";
    let membershipTokyoId = "";
    let membershipNewYorkId = "";

    // 1. Setup Tenant A Records
    await withTenant(orgA, mockDb, async () => {
      // Create lead in Tokyo timezone (JST, UTC+9)
      const leadTokyo = await dbStore.leads.insert({
        orgId: orgA,
        ownerId: "user-a",
        email: "tokyo@tenant-a.com",
        status: "New",
        custom: { timezone: "Asia/Tokyo" },
      });
      _leadTokyoId = leadTokyo.id;

      // Create lead in New York timezone (EST/EDT, UTC-4/UTC-5)
      const leadNewYork = await dbStore.leads.insert({
        orgId: orgA,
        ownerId: "user-a",
        email: "ny@tenant-a.com",
        status: "New",
        custom: { timezone: "America/New_York" },
      });
      _leadNewYorkId = leadNewYork.id;

      // Create email template
      const template = await dbStore.emailTemplates.insert({
        orgId: orgA,
        name: "Welcome Template",
        subject: "Hello!",
        body: "Welcome to Acme",
      });

      // Create sequence with weekday constraints and 09:00 to 17:00 window
      const seq = await dbStore.marketingSequences.insert({
        orgId: orgA,
        name: "Acme Weekday Sequence",
        description: "Sends only on weekdays during business hours",
        status: "active",
        sendingDays: [1, 2, 3, 4, 5], // Monday to Friday
        sendingWindowStart: "09:00",
        sendingWindowEnd: "17:00",
      });
      _sequenceId = seq.id;

      // Create step 1
      const step = await dbStore.marketingSequenceSteps.insert({
        orgId: orgA,
        sequenceId: seq.id,
        stepNumber: 1,
        delayDays: 0,
        templateId: template.id,
      });
      _stepId = step.id;

      // Enroll Tokyo Lead (should execute)
      const m1 = await dbStore.marketingSequenceMemberships.insert({
        orgId: orgA,
        sequenceId: seq.id,
        recordType: "lead",
        recordId: leadTokyo.id,
        status: "active",
        currentStepNumber: 0,
        nextExecutionAt: new Date("2026-05-29T02:00:00Z"), // Friday 2:00 AM UTC
      });
      membershipTokyoId = m1.id;

      // Enroll New York Lead (should defer because Thursday 10:00 PM local is outside 09:00 - 17:00 window)
      const m2 = await dbStore.marketingSequenceMemberships.insert({
        orgId: orgA,
        sequenceId: seq.id,
        recordType: "lead",
        recordId: leadNewYork.id,
        status: "active",
        currentStepNumber: 0,
        nextExecutionAt: new Date("2026-05-29T02:00:00Z"), // Thursday 10:00 PM local time
      });
      membershipNewYorkId = m2.id;
    });

    // 2. Run executePendingSequenceSteps at Friday 2:00 AM UTC
    const currentTime = new Date("2026-05-29T02:00:00Z");
    await withTenant(orgA, mockDb, async () => {
      const processed = await executePendingSequenceSteps(
        // biome-ignore lint/suspicious/noExplicitAny: mock dbStore cast is safe for testing
        dbStore as any,
        currentTime,
      );
      expect(processed).toBe(1); // 1 executed, NY is deferred and not counted in processed count
    });

    // 3. Verify execution results in Tenant A
    await withTenant(orgA, mockDb, async () => {
      // Verify Tokyo Lead executed successfully
      const mTokyo =
        await dbStore.marketingSequenceMemberships.findOne(membershipTokyoId);
      expect(mTokyo?.status).toBe("completed"); // Completed because only 1 step exists
      expect(mTokyo?.currentStepNumber).toBe(1);
      expect(mTokyo?.lastExecutedAt).not.toBeNull();

      // Verify New York Lead got deferred
      const mNY =
        await dbStore.marketingSequenceMemberships.findOne(membershipNewYorkId);
      expect(mNY?.status).toBe("active"); // Still active
      expect(mNY?.currentStepNumber).toBe(0); // Not executed yet
      expect(mNY?.nextExecutionAt).not.toBeNull();

      // Deferral time calculation: Friday 09:00 AM New York local time.
      // New York local offset at 2026-05-29 (DST Active) is UTC-4.
      // So local 09:00 AM Friday = 13:00 PM UTC Friday.
      const deferredUTCStr = new Date(
        mNY?.nextExecutionAt as Date,
      ).toISOString();
      expect(deferredUTCStr).toBe("2026-05-29T13:00:00.000Z");

      // Verify audit logs captured the deferral
      const logs = await dbStore.auditLogs.findMany();
      const deferralLogs = logs.filter(
        (l) => l.action === "membership_schedule_deferred",
      );
      expect(deferralLogs.length).toBe(1);
      expect(deferralLogs[0].recordId).toBe(membershipNewYorkId);
    });
  });

  it("should enforce strict tenant RLS isolation during timezone-aware sequence runs", async () => {
    // 1. Setup Tenant A Sequence
    await withTenant(orgA, mockDb, async () => {
      const lead = await dbStore.leads.insert({
        orgId: orgA,
        ownerId: "user-a",
        email: "alice@tenant-a.com",
        status: "New",
        custom: { timezone: "America/New_York" },
      });

      const seq = await dbStore.marketingSequences.insert({
        orgId: orgA,
        name: "Tenant A Sequence",
        status: "active",
        sendingDays: [1, 2, 3, 4, 5],
        sendingWindowStart: "09:00",
        sendingWindowEnd: "17:00",
      });

      await dbStore.marketingSequenceMemberships.insert({
        orgId: orgA,
        sequenceId: seq.id,
        recordType: "lead",
        recordId: lead.id,
        status: "active",
        currentStepNumber: 0,
        nextExecutionAt: new Date("2026-05-29T02:00:00Z"),
      });
    });

    // 2. Setup Tenant B Sequence
    await withTenant(orgB, mockDb, async () => {
      const lead = await dbStore.leads.insert({
        orgId: orgB,
        ownerId: "user-b",
        email: "bob@tenant-b.com",
        status: "New",
        custom: { timezone: "Asia/Tokyo" },
      });

      const seq = await dbStore.marketingSequences.insert({
        orgId: orgB,
        name: "Tenant B Sequence",
        status: "active",
        sendingDays: [1, 2, 3, 4, 5],
        sendingWindowStart: "09:00",
        sendingWindowEnd: "17:00",
      });

      await dbStore.marketingSequenceMemberships.insert({
        orgId: orgB,
        sequenceId: seq.id,
        recordType: "lead",
        recordId: lead.id,
        status: "active",
        currentStepNumber: 0,
        nextExecutionAt: new Date("2026-05-29T02:00:00Z"),
      });
    });

    // 3. Run executePendingSequenceSteps under Tenant B context (bob)
    // It must ONLY process Tenant B's sequence membership (Tokyo lead, JST 11:00 AM, should execute)
    // and MUST NOT touch or execute Tenant A's sequence membership (New York lead)
    const currentTime = new Date("2026-05-29T02:00:00Z");
    await withTenant(orgB, mockDb, async () => {
      const processed = await executePendingSequenceSteps(
        // biome-ignore lint/suspicious/noExplicitAny: mock dbStore cast is safe for testing
        dbStore as any,
        currentTime,
      );
      // Tokyo Lead executed, total processed is 1
      expect(processed).toBe(1);
    });

    // 4. Verify Tenant A's records remain completely untouched! (Absolute RLS validation)
    await withTenant(orgA, mockDb, async () => {
      const membershipsA =
        await dbStore.marketingSequenceMemberships.findMany();
      expect(membershipsA[0].status).toBe("active");
      expect(membershipsA[0].currentStepNumber).toBe(0); // Still 0, was not processed!
    });
  });
});
