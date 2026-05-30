import { createSessionToken } from "@crm/auth";
import { dbStore, mockDb, withTenant } from "@crm/db";
import { beforeEach, describe, expect, it } from "vitest";
import { createTestApp } from "./_harness";

const app = createTestApp();

describe("Marketing Sequence Cloning Engine Tests (Task 0213)", () => {
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

  describe("Integration & RLS Isolation Tests", () => {
    it("should successfully clone a sequence with steps, branches, actions, split tests, exit triggers, and tags", async () => {
      let originalSeqId = "";
      let tagId = "";
      const templateId = "temp-email-1";

      // 1. Seed sequence with all child configurations under Tenant A
      await withTenant(orgA, mockDb, async () => {
        // Create an Email Template
        await dbStore.emailTemplates.insert({
          orgId: orgA,
          name: "Welcome Email",
          subject: "Hi {{firstName}}",
          body: "Hello!",
        });

        // Create a sequence
        const seq = await dbStore.marketingSequences.insert({
          orgId: orgA,
          name: "Acme Master Drip",
          description: "High-value enterprise sequence",
          status: "active",
          sendingWindowStart: "09:00",
          sendingWindowEnd: "17:00",
          allowReenrollment: true,
          reenrollmentMinDays: 30,
          dailySendLimit: 100,
        });
        originalSeqId = seq.id;

        // Add a step
        const step1 = await dbStore.marketingSequenceSteps.insert({
          orgId: orgA,
          sequenceId: seq.id,
          stepNumber: 1,
          delayDays: 2,
          templateId,
          waitCondition: { type: "open" },
        });

        // Add a branch for step 1
        await dbStore.marketingSequenceStepBranches.insert({
          orgId: orgA,
          stepId: step1.id,
          branchType: "email_open",
          evaluationWindowDays: 3,
          trueNextStepNumber: 2,
          falseNextStepNumber: 3,
        });

        // Add a split test for step 1
        await dbStore.marketingSequenceStepSplitTests.insert({
          orgId: orgA,
          stepId: step1.id,
          variantTemplateId: templateId,
          splitWeight: 50,
          isActive: 1,
          autoPromoteWinner: 1,
          minSendsToEvaluate: 10,
          evaluationMetric: "open_rate",
        });

        // Add an open action for step 1
        await dbStore.marketingSequenceOpenActions.insert({
          orgId: orgA,
          stepId: step1.id,
          actionType: "field_update",
          actionConfig: { field: "status", value: "Engaged" },
        });

        // Add a link action for step 1
        await dbStore.marketingSequenceLinkActions.insert({
          orgId: orgA,
          stepId: step1.id,
          targetUrl: "https://acme.com/pricing",
          actionType: "create_task",
          actionConfig: { subject: "Follow up on pricing click" },
        });

        // Add an exit trigger for sequence
        await dbStore.marketingSequenceExitTriggers.insert({
          orgId: orgA,
          sequenceId: seq.id,
          triggerType: "opportunity_stage_changed",
          criteria: { stage: "Closed Won" },
          isActive: 1,
        });

        // Add a tag and map it
        const tag = await dbStore.marketingSequenceTags.insert({
          orgId: orgA,
          name: "Hot Lead",
          color: "#FF0000",
        });
        tagId = tag.id;

        await dbStore.marketingSequenceTagMappings.insert({
          orgId: orgA,
          sequenceId: seq.id,
          tagId: tag.id,
        });
      });

      // 2. Clone the sequence using the API as Tenant A
      const cloneRes = await app.request(
        `/api/sequences/${originalSeqId}/clone`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${tokenTenantA}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ name: "Acme Master Drip v2" }),
        },
      );

      expect(cloneRes.status).toBe(200);
      const cloneBody = await cloneRes.json();
      expect(cloneBody.success).toBe(true);
      expect(cloneBody.sequence.id).toBeDefined();
      expect(cloneBody.sequence.id).not.toBe(originalSeqId);
      expect(cloneBody.sequence.name).toBe("Acme Master Drip v2");
      expect(cloneBody.sequence.orgId).toBe(orgA);
      expect(cloneBody.sequence.status).toBe("draft"); // ALWAYS draft on clone

      const clonedId = cloneBody.sequence.id;

      // 3. Verify that all components have been copied correctly inside the DB under Tenant A
      await withTenant(orgA, mockDb, async () => {
        // Root fields cloned
        const clonedSeq = await dbStore.marketingSequences.findOne(clonedId);
        expect(clonedSeq).toBeDefined();
        expect(clonedSeq?.description).toBe("High-value enterprise sequence");
        expect(clonedSeq?.sendingWindowStart).toBe("09:00");
        expect(clonedSeq?.allowReenrollment).toBe(true);

        // Steps cloned
        const steps =
          await dbStore.marketingSequenceSteps.findForSequence(clonedId);
        expect(steps.length).toBe(1);
        const step = steps[0];
        expect(step.stepNumber).toBe(1);
        expect(step.delayDays).toBe(2);
        expect(step.templateId).toBe(templateId);
        expect(step.waitCondition).toEqual({ type: "open" });

        // Branch cloned
        const branch = await dbStore.marketingSequenceStepBranches.findForStep(
          step.id,
        );
        expect(branch).toBeDefined();
        expect(branch?.branchType).toBe("email_open");
        expect(branch?.trueNextStepNumber).toBe(2);

        // Split test cloned
        const splitTest =
          await dbStore.marketingSequenceStepSplitTests.findForStep(step.id);
        expect(splitTest).toBeDefined();
        expect(splitTest?.evaluationMetric).toBe("open_rate");
        expect(splitTest?.splitWeight).toBe(50);

        // Actions cloned
        const openActions =
          await dbStore.marketingSequenceOpenActions.findForStep(step.id);
        expect(openActions.length).toBe(1);
        expect(openActions[0].actionType).toBe("field_update");

        const linkActions =
          await dbStore.marketingSequenceLinkActions.findForStep(step.id);
        expect(linkActions.length).toBe(1);
        expect(linkActions[0].targetUrl).toBe("https://acme.com/pricing");

        // Exit triggers cloned
        const exitTriggers =
          await dbStore.marketingSequenceExitTriggers.findForSequence(clonedId);
        expect(exitTriggers.length).toBe(1);
        expect(exitTriggers[0].triggerType).toBe("opportunity_stage_changed");

        // Tag mappings cloned
        const mappings =
          await dbStore.marketingSequenceTagMappings.findForSequence(clonedId);
        expect(mappings.length).toBe(1);
        expect(mappings[0].tagId).toBe(tagId);
      });
    });

    it("should default name to Original Name - Copy if no name is provided in request body", async () => {
      let originalSeqId = "";

      await withTenant(orgA, mockDb, async () => {
        const seq = await dbStore.marketingSequences.insert({
          orgId: orgA,
          name: "Outbound Blast",
          description: "",
          status: "draft",
        });
        originalSeqId = seq.id;
      });

      const cloneRes = await app.request(
        `/api/sequences/${originalSeqId}/clone`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${tokenTenantA}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({}),
        },
      );

      expect(cloneRes.status).toBe(200);
      const cloneBody = await cloneRes.json();
      expect(cloneBody.success).toBe(true);
      expect(cloneBody.sequence.name).toBe("Outbound Blast - Copy");
    });

    it("should reject cloning with 404 if the sequence belongs to another organization (RLS isolation)", async () => {
      let originalSeqId = "";

      // Seed sequence under Tenant A
      await withTenant(orgA, mockDb, async () => {
        const seq = await dbStore.marketingSequences.insert({
          orgId: orgA,
          name: "Acme Master Drip",
          description: "High-value enterprise sequence",
          status: "active",
        });
        originalSeqId = seq.id;
      });

      // Attempt to clone as Tenant B
      const cloneRes = await app.request(
        `/api/sequences/${originalSeqId}/clone`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${tokenTenantB}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ name: "Stolen Copy" }),
        },
      );

      expect(cloneRes.status).toBe(404);
      const cloneBody = await cloneRes.json();
      expect(cloneBody.success).toBe(false);
      expect(cloneBody.error).toContain("Sequence not found");
    });

    it("should return 404 if the sequence does not exist", async () => {
      const cloneRes = await app.request(
        "/api/sequences/non-existent-seq/clone",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${tokenTenantA}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ name: "Ghost Copy" }),
        },
      );

      expect(cloneRes.status).toBe(404);
      const cloneBody = await cloneRes.json();
      expect(cloneBody.success).toBe(false);
      expect(cloneBody.error).toContain("Sequence not found");
    });
  });
});
