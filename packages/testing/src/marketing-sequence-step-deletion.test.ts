import { createSessionToken } from "@crm/auth";
import { dbStore, mockDb, withTenant } from "@crm/db";
import { beforeEach, describe, expect, it } from "vitest";
import { createTestApp } from "./_harness";

const app = createTestApp();

describe("Marketing Sequence Step Deletion & Cascading Shift Engine Tests (Task 0217)", () => {
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
    it("should successfully delete a step, shift subsequent steps, and clean/remap reply and branching references", async () => {
      let sequenceId = "";
      const stepIds: string[] = [];
      let templateId = "";
      let branchId1 = "";
      let branchId2 = "";

      // 1. Seed active sequence, template, steps, and branches under Tenant A
      await withTenant(orgA, mockDb, async () => {
        const seq = await dbStore.marketingSequences.insert({
          orgId: orgA,
          name: "Sequence to delete step from",
          description: "Delete test",
          status: "active",
        });
        sequenceId = seq.id;

        const tmpl = await dbStore.emailTemplates.insert({
          orgId: orgA,
          name: "Template A",
          subject: "Sub A",
          body: "Body A",
        });
        templateId = tmpl.id;

        // Create 4 steps
        // Step 1
        const s1 = await dbStore.marketingSequenceSteps.insert({
          orgId: orgA,
          sequenceId,
          stepNumber: 1,
          delayDays: 1,
          templateId,
        });
        // Step 2
        const s2 = await dbStore.marketingSequenceSteps.insert({
          orgId: orgA,
          sequenceId,
          stepNumber: 2,
          delayDays: 1,
          templateId,
        });
        // Step 3 (replies to step 2)
        const s3 = await dbStore.marketingSequenceSteps.insert({
          orgId: orgA,
          sequenceId,
          stepNumber: 3,
          delayDays: 1,
          templateId,
          replyToStepNumber: 2,
        });
        // Step 4 (replies to step 3)
        const s4 = await dbStore.marketingSequenceSteps.insert({
          orgId: orgA,
          sequenceId,
          stepNumber: 4,
          delayDays: 1,
          templateId,
          replyToStepNumber: 3,
        });

        stepIds.push(s1.id, s2.id, s3.id, s4.id);

        // Branch on Step 1: True goes to Step 2, False goes to Step 4
        const br1 = await dbStore.marketingSequenceStepBranches.insert({
          orgId: orgA,
          stepId: s1.id,
          branchType: "email_open",
          evaluationWindowDays: 3,
          trueNextStepNumber: 2,
          falseNextStepNumber: 4,
        });
        branchId1 = br1.id;

        // Branch on Step 2 (to be deleted): True goes to Step 3, False goes to Step 4
        const br2 = await dbStore.marketingSequenceStepBranches.insert({
          orgId: orgA,
          stepId: s2.id,
          branchType: "email_click",
          evaluationWindowDays: 3,
          trueNextStepNumber: 3,
          falseNextStepNumber: 4,
        });
        branchId2 = br2.id;
      });

      // 2. Perform deletion of Step 2 (s2)
      const deleteRes = await app.request(
        `/api/sequences/${sequenceId}/steps/${stepIds[1]}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${tokenTenantA}`,
          },
        },
      );

      expect(deleteRes.status).toBe(200);
      const body = await deleteRes.json();
      expect(body.success).toBe(true);
      expect(body.steps).toHaveLength(3);

      // Verify the new step numbers of remaining steps in order
      const step1 = body.steps.find((s: { id: string }) => s.id === stepIds[0]);
      const step3 = body.steps.find((s: { id: string }) => s.id === stepIds[2]);
      const step4 = body.steps.find((s: { id: string }) => s.id === stepIds[3]);

      // Step 1 stays at stepNumber 1
      expect(step1.stepNumber).toBe(1);
      // Step 3 (old Step 3) becomes stepNumber 2
      expect(step3.stepNumber).toBe(2);
      // Step 4 (old Step 4) becomes stepNumber 3
      expect(step4.stepNumber).toBe(3);

      // Verify replyToStepNumber remapping:
      // Old Step 3 replied to Old Step 2 (which was deleted). So step3.replyToStepNumber must become null!
      expect(step3.replyToStepNumber).toBeNull();

      // Old Step 4 replied to Old Step 3 (now stepNumber 2). So step4.replyToStepNumber must become 2!
      expect(step4.replyToStepNumber).toBe(2);

      // Verify branching references in DB
      await withTenant(orgA, mockDb, async () => {
        // Branch 2 (belonging to deleted Step 2) should be deleted entirely
        const br2 =
          await dbStore.marketingSequenceStepBranches.findOne(branchId2);
        expect(br2).toBeNull();

        // Branch 1 (belonging to Step 1):
        const br1 =
          await dbStore.marketingSequenceStepBranches.findOne(branchId1);
        expect(br1).toBeDefined();
        // True next step pointed to Old Step 2 (deleted). So it must be set to null.
        expect(br1?.trueNextStepNumber).toBeNull();
        // False next step pointed to Old Step 4 (now stepNumber 3). So it must become 3.
        expect(br1?.falseNextStepNumber).toBe(3);
      });
    });

    it("should reject step deletion requests from an unauthorized tenant (RLS Isolation)", async () => {
      let sequenceId = "";
      let stepId = "";

      await withTenant(orgA, mockDb, async () => {
        const seq = await dbStore.marketingSequences.insert({
          orgId: orgA,
          name: "Tenant A Sequence",
          description: "Tenancy RLS check",
          status: "active",
        });
        sequenceId = seq.id;

        const tmpl = await dbStore.emailTemplates.insert({
          orgId: orgA,
          name: "Template A",
          subject: "Sub A",
          body: "Body A",
        });

        const step = await dbStore.marketingSequenceSteps.insert({
          orgId: orgA,
          sequenceId,
          stepNumber: 1,
          delayDays: 1,
          templateId: tmpl.id,
        });
        stepId = step.id;
      });

      // Tenant B tries to delete Tenant A's step
      const deleteRes = await app.request(
        `/api/sequences/${sequenceId}/steps/${stepId}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${tokenTenantB}`,
          },
        },
      );

      // Should return 404 Not Found due to RLS Isolation
      expect(deleteRes.status).toBe(404);
      const body = await deleteRes.json();
      expect(body.success).toBe(false);
      expect(body.error).toContain("Sequence not found");

      // Verify step was NOT deleted
      await withTenant(orgA, mockDb, async () => {
        const step = await dbStore.marketingSequenceSteps.findOne(stepId);
        expect(step).not.toBeNull();
      });
    });
  });
});
