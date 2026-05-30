import { createSessionToken } from "@crm/auth";
import { executePendingSequenceSteps } from "@crm/core";
import { dbStore, mockDb, store, withTenant } from "@crm/db";
import { beforeEach, describe, expect, it } from "vitest";
import { createTestApp } from "./_harness";

const app = createTestApp();

describe("Marketing Sequence Dynamic Branching Engine API & Logic Tests (Task 0183)", () => {
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

  it("should support CRUD on step branching rules with strict tenant RLS isolation", async () => {
    let seqId = "";
    let stepId = "";
    let templateId = "";

    await withTenant(orgA, mockDb, async () => {
      const template = await dbStore.emailTemplates.insert({
        orgId: orgA,
        name: "Welcome Email",
        subject: "Welcome!",
        body: "Thanks for joining us",
      });
      templateId = template.id;

      const seq = await dbStore.marketingSequences.insert({
        orgId: orgA,
        name: "Onboarding Flow",
        description: "Onboarding sequence",
        status: "active",
      });
      seqId = seq.id;

      const step = await dbStore.marketingSequenceSteps.insert({
        orgId: orgA,
        sequenceId: seqId,
        stepNumber: 1,
        delayDays: 0,
        templateId,
      });
      stepId = step.id;
    });

    // 1. Create branching rule via POST API
    const createRes = await app.request(
      `/api/sequences/${seqId}/steps/${stepId}/branch`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenTenantA}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          branchType: "email_click",
          evaluationWindowDays: 3,
          trueNextStepNumber: 2,
          falseNextStepNumber: 3,
        }),
      },
    );
    expect(createRes.status).toBe(200);
    const createData = await createRes.json();
    expect(createData.success).toBe(true);
    expect(createData.data.branchType).toBe("email_click");
    expect(createData.data.evaluationWindowDays).toBe(3);
    expect(createData.data.trueNextStepNumber).toBe(2);
    expect(createData.data.falseNextStepNumber).toBe(3);

    // 2. Read branching rule via GET API
    const getRes = await app.request(
      `/api/sequences/${seqId}/steps/${stepId}/branch`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${tokenTenantA}`,
        },
      },
    );
    expect(getRes.status).toBe(200);
    const getData = await getRes.json();
    expect(getData.success).toBe(true);
    expect(getData.data.branchType).toBe("email_click");

    // 3. Verify Tenant Isolation (Tenant B trying to access/modify Tenant A's branching rule)
    const badGetRes = await app.request(
      `/api/sequences/${seqId}/steps/${stepId}/branch`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${tokenTenantB}`,
        },
      },
    );
    expect(badGetRes.status).toBe(404);

    const badCreateRes = await app.request(
      `/api/sequences/${seqId}/steps/${stepId}/branch`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenTenantB}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          branchType: "email_click",
          evaluationWindowDays: 3,
          trueNextStepNumber: 2,
          falseNextStepNumber: 3,
        }),
      },
    );
    expect(badCreateRes.status).toBe(404);

    // 4. Delete branching rule via DELETE API
    const deleteRes = await app.request(
      `/api/sequences/${seqId}/steps/${stepId}/branch`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${tokenTenantA}`,
        },
      },
    );
    expect(deleteRes.status).toBe(200);
    const deleteData = await deleteRes.json();
    expect(deleteData.success).toBe(true);

    // Verify it is gone
    const verifyGetRes = await app.request(
      `/api/sequences/${seqId}/steps/${stepId}/branch`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${tokenTenantA}`,
        },
      },
    );
    expect(verifyGetRes.status).toBe(404);
  });

  it("should dynamically route to trueNextStepNumber if wait window event is met (click > 0)", async () => {
    let seqId = "";
    let stepId1 = "";
    let _stepId2 = "";
    const _stepId3 = "";
    let leadId = "";
    let membershipId = "";
    const now = new Date("2026-05-29T10:00:00Z");

    await withTenant(orgA, mockDb, async () => {
      // 1. Seed templates
      const template1 = await dbStore.emailTemplates.insert({
        orgId: orgA,
        name: "Welcome Email",
        subject: "Subject 1",
        body: "Body 1",
      });
      const template2 = await dbStore.emailTemplates.insert({
        orgId: orgA,
        name: "Follow-up Clicked",
        subject: "Subject 2",
        body: "Body 2",
      });
      const _template3 = await dbStore.emailTemplates.insert({
        orgId: orgA,
        name: "Follow-up Cold",
        subject: "Subject 3",
        body: "Body 3",
      });

      // 2. Create sequence
      const seq = await dbStore.marketingSequences.insert({
        orgId: orgA,
        name: "Branching Sequence",
        description: "Sequence with branching logic",
        status: "active",
      });
      seqId = seq.id;

      // 3. Create steps
      const step1 = await dbStore.marketingSequenceSteps.insert({
        orgId: orgA,
        sequenceId: seqId,
        stepNumber: 1,
        delayDays: 0,
        templateId: template1.id,
      });
      stepId1 = step1.id;

      const step2 = await dbStore.marketingSequenceSteps.insert({
        orgId: orgA,
        sequenceId: seqId,
        stepNumber: 2,
        delayDays: 0,
        templateId: template2.id,
      });
      _stepId2 = step2.id;

      // 4. Create branch rule for Step 1
      await dbStore.marketingSequenceStepBranches.insert({
        orgId: orgA,
        stepId: stepId1,
        branchType: "email_click",
        evaluationWindowDays: 3,
        trueNextStepNumber: 2,
        falseNextStepNumber: 3,
      });

      // 5. Seed Lead
      const lead = await dbStore.leads.insert({
        orgId: orgA,
        ownerId: "user-a",
        status: "New",
        email: "branched-lead@test.com",
        company: "Branch Corp",
        convertedAccountId: null,
        convertedContactId: null,
        custom: null,
      });
      leadId = lead.id;

      // 6. Enroll Lead in Sequence
      const memb = await dbStore.marketingSequenceMemberships.insert({
        orgId: orgA,
        sequenceId: seqId,
        recordType: "lead",
        recordId: leadId,
        status: "active",
        currentStepNumber: 0,
        lastExecutedAt: null,
        nextExecutionAt: now,
      });
      membershipId = memb.id;

      // First run: execute step 1
      const processed1 = await executePendingSequenceSteps(dbStore, now);
      expect(processed1).toBe(1);

      // Verify that step 1 was executed, and next execution is scheduled in 3 days
      const updatedMemb =
        await dbStore.marketingSequenceMemberships.findOne(membershipId);
      expect(updatedMemb?.currentStepNumber).toBe(1);
      expect(updatedMemb?.status).toBe("active");
      const expectedResumeTime = new Date(
        now.getTime() + 3 * 24 * 60 * 60 * 1000,
      );
      expect(updatedMemb?.nextExecutionAt.toISOString()).toBe(
        expectedResumeTime.toISOString(),
      );

      // 7. Simulates recipient email click event
      const trackers = await store.emailTrackers;
      expect(trackers.length).toBe(1);
      trackers[0].clickCount = 1; // Click event registered!

      // 3 days later: resume sequence
      const resumeTime = new Date(
        now.getTime() + 3 * 24 * 60 * 60 * 1000 + 1000,
      ); // 3 days + 1s
      const processed2 = await executePendingSequenceSteps(dbStore, resumeTime);
      expect(processed2).toBe(1);

      // Expect dynamic routing to step 2 (True path)
      const finalMemb =
        await dbStore.marketingSequenceMemberships.findOne(membershipId);
      expect(finalMemb?.currentStepNumber).toBe(2);
      expect(finalMemb?.status).toBe("completed"); // Since step 2 has no subsequent step, it completes!

      // Verify activity logs show Step 2's template was sent
      const activities = await dbStore.activities.findMany();
      expect(activities.length).toBe(2); // Step 1 + Step 2
      expect(activities[1].subject).toBe("Subject 2"); // Step 2 sent!
    });
  });

  it("should dynamically route to falseNextStepNumber if wait window event is not met (click === 0)", async () => {
    let seqId = "";
    let stepId1 = "";
    let leadId = "";
    let membershipId = "";
    const now = new Date("2026-05-29T10:00:00Z");

    await withTenant(orgA, mockDb, async () => {
      // 1. Seed templates
      const template1 = await dbStore.emailTemplates.insert({
        orgId: orgA,
        name: "Welcome Email",
        subject: "Subject 1",
        body: "Body 1",
      });
      const _template2 = await dbStore.emailTemplates.insert({
        orgId: orgA,
        name: "Follow-up Clicked",
        subject: "Subject 2",
        body: "Body 2",
      });
      const template3 = await dbStore.emailTemplates.insert({
        orgId: orgA,
        name: "Follow-up Cold",
        subject: "Subject 3",
        body: "Body 3",
      });

      // 2. Create sequence
      const seq = await dbStore.marketingSequences.insert({
        orgId: orgA,
        name: "Branching Sequence",
        description: "Sequence with branching logic",
        status: "active",
      });
      seqId = seq.id;

      // 3. Create steps
      const step1 = await dbStore.marketingSequenceSteps.insert({
        orgId: orgA,
        sequenceId: seqId,
        stepNumber: 1,
        delayDays: 0,
        templateId: template1.id,
      });
      stepId1 = step1.id;

      await dbStore.marketingSequenceSteps.insert({
        orgId: orgA,
        sequenceId: seqId,
        stepNumber: 3,
        delayDays: 0,
        templateId: template3.id,
      });

      // 4. Create branch rule for Step 1
      await dbStore.marketingSequenceStepBranches.insert({
        orgId: orgA,
        stepId: stepId1,
        branchType: "email_click",
        evaluationWindowDays: 3,
        trueNextStepNumber: 2,
        falseNextStepNumber: 3,
      });

      // 5. Seed Lead
      const lead = await dbStore.leads.insert({
        orgId: orgA,
        ownerId: "user-a",
        status: "New",
        email: "branched-lead@test.com",
        company: "Branch Corp",
        convertedAccountId: null,
        convertedContactId: null,
        custom: null,
      });
      leadId = lead.id;

      // 6. Enroll Lead in Sequence
      const memb = await dbStore.marketingSequenceMemberships.insert({
        orgId: orgA,
        sequenceId: seqId,
        recordType: "lead",
        recordId: leadId,
        status: "active",
        currentStepNumber: 0,
        lastExecutedAt: null,
        nextExecutionAt: now,
      });
      membershipId = memb.id;

      // First run: execute step 1
      const processed1 = await executePendingSequenceSteps(dbStore, now);
      expect(processed1).toBe(1);

      // We do NOT registers any email clicks (clickCount remains 0)

      // 3 days later: resume sequence
      const resumeTime = new Date(
        now.getTime() + 3 * 24 * 60 * 60 * 1000 + 1000,
      ); // 3 days + 1s
      const processed2 = await executePendingSequenceSteps(dbStore, resumeTime);
      expect(processed2).toBe(1);

      // Expect dynamic routing to step 3 (False path)
      const finalMemb =
        await dbStore.marketingSequenceMemberships.findOne(membershipId);
      expect(finalMemb?.currentStepNumber).toBe(3);
      expect(finalMemb?.status).toBe("completed");

      // Verify activity logs show Step 3's template was sent
      const activities = await dbStore.activities.findMany();
      expect(activities.length).toBe(2);
      expect(activities[1].subject).toBe("Subject 3"); // Step 3 sent!
    });
  });
});
