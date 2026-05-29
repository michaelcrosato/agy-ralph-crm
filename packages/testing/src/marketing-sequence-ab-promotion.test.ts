import { createSessionToken } from "@crm/auth";
import { executePendingSequenceSteps } from "@crm/core";
import { dbStore, mockDb, withTenant } from "@crm/db";
import { beforeEach, describe, expect, it } from "vitest";
import app from "../../../apps/api/src/index";

describe("Marketing Sequence A/B Split Testing Auto-Promotion API & Logic Tests (Task 0193)", () => {
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

  it("should validate and persist auto-promotion config parameters through the API with RLS checks", async () => {
    let seqId = "";
    let stepId = "";
    let templateId = "";
    let variantTemplateId = "";

    await withTenant(orgA, mockDb, async () => {
      const templateA = await dbStore.emailTemplates.insert({
        orgId: orgA,
        name: "Template A",
        subject: "Subject A",
        body: "Body A",
      });
      templateId = templateA.id;

      const templateB = await dbStore.emailTemplates.insert({
        orgId: orgA,
        name: "Template B",
        subject: "Subject B",
        body: "Body B",
      });
      variantTemplateId = templateB.id;

      const seq = await dbStore.marketingSequences.insert({
        orgId: orgA,
        name: "Welcome Drip",
        description: "Welcome sequence",
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

    // 1. Invalid autoPromoteWinner validation
    const res1 = await app.request(
      `/api/sequences/${seqId}/steps/${stepId}/split-test`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenTenantA}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          variantTemplateId,
          autoPromoteWinner: 3, // invalid value
        }),
      },
    );
    expect(res1.status).toBe(400);

    // 2. Invalid minSendsToEvaluate validation
    const res2 = await app.request(
      `/api/sequences/${seqId}/steps/${stepId}/split-test`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenTenantA}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          variantTemplateId,
          minSendsToEvaluate: -5, // invalid bounds
        }),
      },
    );
    expect(res2.status).toBe(400);

    // 3. Invalid evaluationMetric validation
    const res3 = await app.request(
      `/api/sequences/${seqId}/steps/${stepId}/split-test`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenTenantA}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          variantTemplateId,
          evaluationMetric: "conversion_rate", // invalid metric
        }),
      },
    );
    expect(res3.status).toBe(400);

    // 4. Valid setup
    const res4 = await app.request(
      `/api/sequences/${seqId}/steps/${stepId}/split-test`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenTenantA}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          variantTemplateId,
          splitWeight: 50,
          isActive: 1,
          autoPromoteWinner: 1,
          minSendsToEvaluate: 4,
          evaluationMetric: "open_rate",
        }),
      },
    );
    expect(res4.status).toBe(200);
    const data4 = await res4.json();
    expect(data4.success).toBe(true);
    expect(data4.data.autoPromoteWinner).toBe(1);
    expect(data4.data.minSendsToEvaluate).toBe(4);
    expect(data4.data.evaluationMetric).toBe("open_rate");

    // 5. RLS Violation Check (Tenant B trying to view/update Tenant A's config)
    const res5 = await app.request(
      `/api/sequences/${seqId}/steps/${stepId}/split-test`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${tokenTenantB}`,
        },
      },
    );
    expect(res5.status).toBe(404);
  });

  it("should auto-promote variant if variant open rate is higher and total sends threshold is reached", async () => {
    let seqId = "";
    let stepId = "";
    let templateIdA = "";
    let templateIdB = "";
    let lead1Id = "";
    let lead2Id = "";
    let lead3Id = "";
    let lead4Id = "";
    let lead5Id = "";

    await withTenant(orgA, mockDb, async () => {
      const templateA = await dbStore.emailTemplates.insert({
        orgId: orgA,
        name: "Template A",
        subject: "Subject A",
        body: "Body A",
      });
      templateIdA = templateA.id;

      const templateB = await dbStore.emailTemplates.insert({
        orgId: orgA,
        name: "Template B",
        subject: "Subject B",
        body: "Body B",
      });
      templateIdB = templateB.id;

      const seq = await dbStore.marketingSequences.insert({
        orgId: orgA,
        name: "A/B Drip",
        status: "active",
      });
      seqId = seq.id;

      const step = await dbStore.marketingSequenceSteps.insert({
        orgId: orgA,
        sequenceId: seqId,
        stepNumber: 1,
        delayDays: 0,
        templateId: templateIdA,
      });
      stepId = step.id;

      // Define split test: auto promote enabled, min sends = 4, open rate
      await dbStore.marketingSequenceStepSplitTests.insert({
        orgId: orgA,
        stepId,
        variantTemplateId: templateIdB,
        splitWeight: 50,
        isActive: 1,
        autoPromoteWinner: 1,
        minSendsToEvaluate: 4,
        evaluationMetric: "open_rate",
      });

      // Insert 5 leads
      const l1 = await dbStore.leads.insert({
        orgId: orgA,
        lastName: "L1",
        email: "l1@example.com",
      });
      lead1Id = l1.id;
      const l2 = await dbStore.leads.insert({
        orgId: orgA,
        lastName: "L2",
        email: "l2@example.com",
      });
      lead2Id = l2.id;
      const l3 = await dbStore.leads.insert({
        orgId: orgA,
        lastName: "L3",
        email: "l3@example.com",
      });
      lead3Id = l3.id;
      const l4 = await dbStore.leads.insert({
        orgId: orgA,
        lastName: "L4",
        email: "l4@example.com",
      });
      lead4Id = l4.id;
      const l5 = await dbStore.leads.insert({
        orgId: orgA,
        lastName: "L5",
        email: "l5@example.com",
      });
      lead5Id = l5.id;

      // Persist prior allocations simulating completed step 1 (currentStepNumber: 1, status: completed)
      const m1 = await dbStore.marketingSequenceMemberships.insert({
        orgId: orgA,
        sequenceId: seqId,
        recordType: "lead",
        recordId: lead1Id,
        status: "completed",
        currentStepNumber: 1,
        nextExecutionAt: new Date(Date.now() - 10000),
      });
      await dbStore.marketingSequenceAbAllocations.insert({
        orgId: orgA,
        membershipId: m1.id,
        stepId,
        allocatedTemplateId: templateIdA,
      });

      const m2 = await dbStore.marketingSequenceMemberships.insert({
        orgId: orgA,
        sequenceId: seqId,
        recordType: "lead",
        recordId: lead2Id,
        status: "completed",
        currentStepNumber: 1,
        nextExecutionAt: new Date(Date.now() - 10000),
      });
      await dbStore.marketingSequenceAbAllocations.insert({
        orgId: orgA,
        membershipId: m2.id,
        stepId,
        allocatedTemplateId: templateIdA,
      });

      const m3 = await dbStore.marketingSequenceMemberships.insert({
        orgId: orgA,
        sequenceId: seqId,
        recordType: "lead",
        recordId: lead3Id,
        status: "completed",
        currentStepNumber: 1,
        nextExecutionAt: new Date(Date.now() - 10000),
      });
      await dbStore.marketingSequenceAbAllocations.insert({
        orgId: orgA,
        membershipId: m3.id,
        stepId,
        allocatedTemplateId: templateIdB,
      });

      const m4 = await dbStore.marketingSequenceMemberships.insert({
        orgId: orgA,
        sequenceId: seqId,
        recordType: "lead",
        recordId: lead4Id,
        status: "completed",
        currentStepNumber: 1,
        nextExecutionAt: new Date(Date.now() - 10000),
      });
      await dbStore.marketingSequenceAbAllocations.insert({
        orgId: orgA,
        membershipId: m4.id,
        stepId,
        allocatedTemplateId: templateIdB,
      });

      // Simulate sending these emails by inserting activities with deterministic sequential alphabetical IDs
      const act1 = await dbStore.activities.insert({
        orgId: orgA,
        creatorId: "user-a",
        type: "email",
        subject: "S1",
        body: "B1",
        dueDate: null,
      });
      act1.id = "activity-1";
      await dbStore.activityLinks.insert({
        orgId: orgA,
        activityId: "activity-1",
        targetType: "Lead",
        targetId: lead1Id,
      });

      const act2 = await dbStore.activities.insert({
        orgId: orgA,
        creatorId: "user-a",
        type: "email",
        subject: "S2",
        body: "B2",
        dueDate: null,
      });
      act2.id = "activity-2";
      await dbStore.activityLinks.insert({
        orgId: orgA,
        activityId: "activity-2",
        targetType: "Lead",
        targetId: lead2Id,
      });

      const act3 = await dbStore.activities.insert({
        orgId: orgA,
        creatorId: "user-a",
        type: "email",
        subject: "S3",
        body: "B3",
        dueDate: null,
      });
      act3.id = "activity-3";
      await dbStore.activityLinks.insert({
        orgId: orgA,
        activityId: "activity-3",
        targetType: "Lead",
        targetId: lead3Id,
      });

      const act4 = await dbStore.activities.insert({
        orgId: orgA,
        creatorId: "user-a",
        type: "email",
        subject: "S4",
        body: "B4",
        dueDate: null,
      });
      act4.id = "activity-4";
      await dbStore.activityLinks.insert({
        orgId: orgA,
        activityId: "activity-4",
        targetType: "Lead",
        targetId: lead4Id,
      });

      // Trackers setup:
      // Base (act1, act2) -> 0 opens
      // Variant (act3, act4) -> 2 opens
      await dbStore.emailTrackers.insert({
        orgId: orgA,
        activityId: "activity-1",
        token: "tok1",
      });
      await dbStore.emailTrackers.insert({
        orgId: orgA,
        activityId: "activity-2",
        token: "tok2",
      });

      const t3 = await dbStore.emailTrackers.insert({
        orgId: orgA,
        activityId: "activity-3",
        token: "tok3",
      });
      await dbStore.emailTrackers.update(t3.id, { openCount: 1 });

      const t4 = await dbStore.emailTrackers.insert({
        orgId: orgA,
        activityId: "activity-4",
        token: "tok4",
      });
      await dbStore.emailTrackers.update(t4.id, { openCount: 1 });

      // Insert 5th membership (which will trigger step evaluation first, hit threshold = 4 sends, and auto-promote Variant B as winner)
      await dbStore.marketingSequenceMemberships.insert({
        orgId: orgA,
        sequenceId: seqId,
        recordType: "lead",
        recordId: lead5Id,
        status: "active",
        nextExecutionAt: new Date(Date.now() - 10000),
        currentStepNumber: 0,
      });
    });

    // Execute engine worker loop inside tenant context
    await withTenant(orgA, mockDb, async () => {
      await executePendingSequenceSteps(dbStore, new Date());
    });

    // Verify expectations:
    await withTenant(orgA, mockDb, async () => {
      // 1. Step default template should be updated to variant template B
      const step = await dbStore.marketingSequenceSteps.findOne(stepId);
      expect(step?.templateId).toBe(templateIdB);

      // 2. Split test should be deactivated
      const splitTests =
        await dbStore.marketingSequenceStepSplitTests.findMany();
      const splitTest = splitTests.find((s) => s.stepId === stepId);
      expect(splitTest?.isActive).toBe(0);

      // 3. Audit trail entry should exist
      const logs = await dbStore.auditLogs.findMany();
      const autoPromotedLog = logs.find(
        (l) =>
          l.recordType === "marketing_sequence_step_split_tests" &&
          l.action === "auto_promoted",
      );
      expect(autoPromotedLog).toBeDefined();
      expect(autoPromotedLog?.changes.winnerLabel.after).toBe("variant");
      expect(autoPromotedLog?.changes.winnerTemplateId.after).toBe(templateIdB);
      expect(autoPromotedLog?.changes.totalSends.after).toBe(4);
    });
  });

  it("should keep split-test active if sends are below threshold", async () => {
    let seqId = "";
    let stepId = "";
    let templateIdA = "";
    let templateIdB = "";
    let lead1Id = "";
    let lead2Id = "";

    await withTenant(orgA, mockDb, async () => {
      const templateA = await dbStore.emailTemplates.insert({
        orgId: orgA,
        name: "Template A",
        subject: "Subject A",
        body: "Body A",
      });
      templateIdA = templateA.id;

      const templateB = await dbStore.emailTemplates.insert({
        orgId: orgA,
        name: "Template B",
        subject: "Subject B",
        body: "Body B",
      });
      templateIdB = templateB.id;

      const seq = await dbStore.marketingSequences.insert({
        orgId: orgA,
        name: "A/B Drip",
        status: "active",
      });
      seqId = seq.id;

      const step = await dbStore.marketingSequenceSteps.insert({
        orgId: orgA,
        sequenceId: seqId,
        stepNumber: 1,
        delayDays: 0,
        templateId: templateIdA,
      });
      stepId = step.id;

      // Define split test: auto promote enabled, min sends = 10, open rate
      await dbStore.marketingSequenceStepSplitTests.insert({
        orgId: orgA,
        stepId,
        variantTemplateId: templateIdB,
        splitWeight: 50,
        isActive: 1,
        autoPromoteWinner: 1,
        minSendsToEvaluate: 10,
        evaluationMetric: "open_rate",
      });

      const l1 = await dbStore.leads.insert({
        orgId: orgA,
        lastName: "L1",
        email: "l1@example.com",
      });
      lead1Id = l1.id;

      // Enrolled but only 1 send exists (below 10 sends threshold)
      const m1 = await dbStore.marketingSequenceMemberships.insert({
        orgId: orgA,
        sequenceId: seqId,
        recordType: "lead",
        recordId: lead1Id,
        status: "completed",
        currentStepNumber: 1,
        nextExecutionAt: new Date(Date.now() - 10000),
      });
      await dbStore.marketingSequenceAbAllocations.insert({
        orgId: orgA,
        membershipId: m1.id,
        stepId,
        allocatedTemplateId: templateIdA,
      });

      const act1 = await dbStore.activities.insert({
        orgId: orgA,
        creatorId: "user-a",
        type: "email",
        subject: "S1",
        body: "B1",
        dueDate: null,
      });
      act1.id = "activity-1";
      await dbStore.activityLinks.insert({
        orgId: orgA,
        activityId: "activity-1",
        targetType: "Lead",
        targetId: lead1Id,
      });
      const t1 = await dbStore.emailTrackers.insert({
        orgId: orgA,
        activityId: "activity-1",
        token: "tok1",
      });
      await dbStore.emailTrackers.update(t1.id, { openCount: 1 });

      // Enroll lead 2 which will process but NOT trigger auto promotion since sends = 1 < 10
      const l2 = await dbStore.leads.insert({
        orgId: orgA,
        lastName: "L2",
        email: "l2@example.com",
      });
      lead2Id = l2.id;
      await dbStore.marketingSequenceMemberships.insert({
        orgId: orgA,
        sequenceId: seqId,
        recordType: "lead",
        recordId: lead2Id,
        status: "active",
        nextExecutionAt: new Date(Date.now() - 10000),
        currentStepNumber: 0,
      });
    });

    // Execute engine worker loop inside tenant context
    await withTenant(orgA, mockDb, async () => {
      await executePendingSequenceSteps(dbStore, new Date());
    });

    // Verify split test is still active
    await withTenant(orgA, mockDb, async () => {
      const splitTests =
        await dbStore.marketingSequenceStepSplitTests.findMany();
      const splitTest = splitTests.find((s) => s.stepId === stepId);
      expect(splitTest?.isActive).toBe(1);

      // default template is still base template A
      const step = await dbStore.marketingSequenceSteps.findOne(stepId);
      expect(step?.templateId).toBe(templateIdA);
    });
  });
});
