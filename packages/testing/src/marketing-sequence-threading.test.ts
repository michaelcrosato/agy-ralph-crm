import { createSessionToken } from "@crm/auth";
import { executePendingSequenceSteps } from "@crm/core";
import { dbStore, mockDb, withTenant } from "@crm/db";
import { beforeEach, describe, expect, it } from "vitest";
import { createTestApp } from "./_harness";

const app = createTestApp();

describe("Marketing Sequence Email Threading Tests (Task 0196)", () => {
  let tokenTenantA: string;
  let _tokenTenantB: string;

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

    _tokenTenantB = await createSessionToken({
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

  it("should validate replyToStepNumber on POST /api/sequences/:id/steps", async () => {
    let seqId = "";
    let templateId = "";

    await withTenant(orgA, mockDb, async () => {
      const seq = await dbStore.marketingSequences.insert({
        orgId: orgA,
        name: "Thread Sequence",
      });
      seqId = seq.id;

      const template = await dbStore.emailTemplates.insert({
        orgId: orgA,
        name: "Welcome",
        subject: "Hello",
        body: "Body",
      });
      templateId = template.id;
    });

    // 1. Create step 1
    const res1 = await app.request(`/api/sequences/${seqId}/steps`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenTenantA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        stepNumber: 1,
        templateId,
      }),
    });
    expect(res1.status).toBe(200);

    // 2. replyToStepNumber is not a positive integer
    const res2 = await app.request(`/api/sequences/${seqId}/steps`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenTenantA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        stepNumber: 2,
        templateId,
        replyToStepNumber: -1,
      }),
    });
    expect(res2.status).toBe(400);

    // 3. replyToStepNumber is equal to current stepNumber
    const res3 = await app.request(`/api/sequences/${seqId}/steps`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenTenantA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        stepNumber: 2,
        templateId,
        replyToStepNumber: 2,
      }),
    });
    expect(res3.status).toBe(400);

    // 4. replyToStepNumber points to a non-existent step
    const res4 = await app.request(`/api/sequences/${seqId}/steps`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenTenantA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        stepNumber: 2,
        templateId,
        replyToStepNumber: 3,
      }),
    });
    expect(res4.status).toBe(400);

    // 5. Valid replyToStepNumber
    const res5 = await app.request(`/api/sequences/${seqId}/steps`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenTenantA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        stepNumber: 2,
        templateId,
        replyToStepNumber: 1,
      }),
    });
    expect(res5.status).toBe(200);
    const body5 = await res5.json();
    expect(body5.step.replyToStepNumber).toBe(1);
  });

  it("should execute step sequence and thread emails correctly", async () => {
    let leadId = "";
    let templateId = "";
    let seqId = "";

    await withTenant(orgA, mockDb, async () => {
      // Recipient Lead
      const lead = await dbStore.leads.insert({
        orgId: orgA,
        ownerId: "user-a",
        status: "New",
        email: "thread-recipient@test.com",
        company: "Acme",
        convertedAccountId: null,
        convertedContactId: null,
        custom: null,
      });
      leadId = lead.id;

      // Email template
      const template = await dbStore.emailTemplates.insert({
        orgId: orgA,
        name: "Drip",
        subject: "Introductory Offer",
        body: "Hello world!",
      });
      templateId = template.id;

      // Sequence
      const seq = await dbStore.marketingSequences.insert({
        orgId: orgA,
        name: "Drip Campaign",
      });
      seqId = seq.id;

      // Step 1: Initial email
      await dbStore.marketingSequenceSteps.insert({
        orgId: orgA,
        sequenceId: seqId,
        stepNumber: 1,
        delayDays: 0,
        templateId,
      });

      // Step 2: Threaded reply step
      await dbStore.marketingSequenceSteps.insert({
        orgId: orgA,
        sequenceId: seqId,
        stepNumber: 2,
        delayDays: 0,
        templateId,
        replyToStepNumber: 1,
      });

      // Enroll Lead in Sequence
      await dbStore.marketingSequenceMemberships.insert({
        orgId: orgA,
        sequenceId: seqId,
        recordType: "lead",
        recordId: leadId,
        status: "active",
        currentStepNumber: 0,
        nextExecutionAt: new Date(),
      });
    });

    // 1. Run execution loop for Step 1
    let p1 = 0;
    await withTenant(orgA, mockDb, async () => {
      p1 = await executePendingSequenceSteps(dbStore, new Date());
    });
    expect(p1).toBe(1);

    let step1ActivityId = "";
    await withTenant(orgA, mockDb, async () => {
      const acts = (await dbStore.activities.findMany?.()) || [];
      expect(acts.length).toBe(1);
      expect(acts[0].subject).toBe("Introductory Offer");
      step1ActivityId = acts[0].id;

      // Advance membership execution time so it executes step 2
      const memberships = await dbStore.marketingSequenceMemberships.findMany();
      await dbStore.marketingSequenceMemberships.update(memberships[0].id, {
        nextExecutionAt: new Date(),
      });
    });

    // 2. Run execution loop for Step 2 (Threaded reply step)
    let p2 = 0;
    await withTenant(orgA, mockDb, async () => {
      p2 = await executePendingSequenceSteps(dbStore, new Date());
    });
    expect(p2).toBe(1);

    await withTenant(orgA, mockDb, async () => {
      const acts = (await dbStore.activities.findMany?.()) || [];
      expect(acts.length).toBe(2);

      // Verify Step 2 email is threaded correctly
      const threadedAct = acts.find((a) => a.id !== step1ActivityId);
      expect(threadedAct).toBeDefined();
      expect(threadedAct?.subject).toBe("Re: Introductory Offer");
      expect(threadedAct?.custom).toBeDefined();
      expect(threadedAct?.custom?.parent_activity_id).toBe(step1ActivityId);
    });
  });

  it("should not double-prefix subjects starting with Re: case-insensitively", async () => {
    let leadId = "";
    let templateId = "";
    let seqId = "";

    await withTenant(orgA, mockDb, async () => {
      const lead = await dbStore.leads.insert({
        orgId: orgA,
        ownerId: "user-a",
        status: "New",
        email: "re-test@test.com",
        company: "Acme",
        convertedAccountId: null,
        convertedContactId: null,
        custom: null,
      });
      leadId = lead.id;

      const template = await dbStore.emailTemplates.insert({
        orgId: orgA,
        name: "Re-drip",
        subject: "re: Welcome to Antigravity!",
        body: "Checking in.",
      });
      templateId = template.id;

      const seq = await dbStore.marketingSequences.insert({
        orgId: orgA,
        name: "Re Campaign",
      });
      seqId = seq.id;

      await dbStore.marketingSequenceSteps.insert({
        orgId: orgA,
        sequenceId: seqId,
        stepNumber: 1,
        delayDays: 0,
        templateId,
      });

      await dbStore.marketingSequenceSteps.insert({
        orgId: orgA,
        sequenceId: seqId,
        stepNumber: 2,
        delayDays: 0,
        templateId,
        replyToStepNumber: 1,
      });

      await dbStore.marketingSequenceMemberships.insert({
        orgId: orgA,
        sequenceId: seqId,
        recordType: "lead",
        recordId: leadId,
        status: "active",
        currentStepNumber: 0,
        nextExecutionAt: new Date(),
      });
    });

    // Run step 1
    await withTenant(orgA, mockDb, async () => {
      await executePendingSequenceSteps(dbStore, new Date());
    });

    // Advance membership execution time
    await withTenant(orgA, mockDb, async () => {
      const memberships = await dbStore.marketingSequenceMemberships.findMany();
      await dbStore.marketingSequenceMemberships.update(memberships[0].id, {
        nextExecutionAt: new Date(),
      });
    });

    // Run step 2
    await withTenant(orgA, mockDb, async () => {
      await executePendingSequenceSteps(dbStore, new Date());
    });

    await withTenant(orgA, mockDb, async () => {
      const acts = (await dbStore.activities.findMany?.()) || [];
      expect(acts.length).toBe(2);

      const threadedAct = acts.find(
        (a) => a.subject.toLowerCase() === "re: welcome to antigravity!",
      );
      expect(threadedAct).toBeDefined();
      // Should remain "re: Welcome to Antigravity!" and NOT become "Re: re: Welcome to Antigravity!"
      expect(threadedAct?.subject).toBe("re: Welcome to Antigravity!");
    });
  });

  it("should enforce RLS isolation boundaries for threading", async () => {
    let leadAId = "";
    let leadBId = "";
    let templateIdA = "";
    let templateIdB = "";
    let seqIdA = "";
    let seqIdB = "";

    // Setup Tenant A sequence and lead
    await withTenant(orgA, mockDb, async () => {
      const lead = await dbStore.leads.insert({
        orgId: orgA,
        ownerId: "user-a",
        status: "New",
        email: "tenant-a-rec@test.com",
        company: "Acme A",
        convertedAccountId: null,
        convertedContactId: null,
        custom: null,
      });
      leadAId = lead.id;

      const template = await dbStore.emailTemplates.insert({
        orgId: orgA,
        name: "Welcome A",
        subject: "Subject A",
        body: "Body A",
      });
      templateIdA = template.id;

      const seq = await dbStore.marketingSequences.insert({
        orgId: orgA,
        name: "Seq A",
      });
      seqIdA = seq.id;

      await dbStore.marketingSequenceSteps.insert({
        orgId: orgA,
        sequenceId: seqIdA,
        stepNumber: 1,
        delayDays: 0,
        templateId: templateIdA,
      });

      await dbStore.marketingSequenceSteps.insert({
        orgId: orgA,
        sequenceId: seqIdA,
        stepNumber: 2,
        delayDays: 0,
        templateId: templateIdA,
        replyToStepNumber: 1,
      });

      await dbStore.marketingSequenceMemberships.insert({
        orgId: orgA,
        sequenceId: seqIdA,
        recordType: "lead",
        recordId: leadAId,
        status: "active",
        currentStepNumber: 0,
        nextExecutionAt: new Date(),
      });
    });

    // Setup Tenant B sequence, lead, and step 1
    await withTenant(orgB, mockDb, async () => {
      const lead = await dbStore.leads.insert({
        orgId: orgB,
        ownerId: "user-b",
        status: "New",
        email: "tenant-b-rec@test.com",
        company: "Acme B",
        convertedAccountId: null,
        convertedContactId: null,
        custom: null,
      });
      leadBId = lead.id;

      const template = await dbStore.emailTemplates.insert({
        orgId: orgB,
        name: "Welcome B",
        subject: "Subject B",
        body: "Body B",
      });
      templateIdB = template.id;

      const seq = await dbStore.marketingSequences.insert({
        orgId: orgB,
        name: "Seq B",
      });
      seqIdB = seq.id;

      await dbStore.marketingSequenceSteps.insert({
        orgId: orgB,
        sequenceId: seqIdB,
        stepNumber: 1,
        delayDays: 0,
        templateId: templateIdB,
      });

      await dbStore.marketingSequenceSteps.insert({
        orgId: orgB,
        sequenceId: seqIdB,
        stepNumber: 2,
        delayDays: 0,
        templateId: templateIdB,
        replyToStepNumber: 1,
      });

      await dbStore.marketingSequenceMemberships.insert({
        orgId: orgB,
        sequenceId: seqIdB,
        recordType: "lead",
        recordId: leadBId,
        status: "active",
        currentStepNumber: 0,
        nextExecutionAt: new Date(),
      });
    });

    // Run Tenant A execution loop (in Tenant A's tenantStorage block)
    await withTenant(orgA, mockDb, async () => {
      const processed = await executePendingSequenceSteps(dbStore, new Date());
      expect(processed).toBe(1);

      // Verify Tenant A only saw their own activities
      const acts = (await dbStore.activities.findMany?.()) || [];
      expect(acts.length).toBe(1);
      expect(acts[0].subject).toBe("Subject A");
    });

    // Run Tenant B execution loop (in Tenant B's tenantStorage block)
    await withTenant(orgB, mockDb, async () => {
      const processed = await executePendingSequenceSteps(dbStore, new Date());
      expect(processed).toBe(1);

      // Verify Tenant B only saw their own activities
      const acts = (await dbStore.activities.findMany?.()) || [];
      expect(acts.length).toBe(1);
      expect(acts[0].subject).toBe("Subject B");
    });
  });
});
