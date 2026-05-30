import { createSessionToken } from "@crm/auth";
import { dbStore, mockDb, withTenant } from "@crm/db";
import { beforeEach, describe, expect, it } from "vitest";
import { createTestApp } from "./_harness";

const app = createTestApp();

describe("Marketing Sequence Step Reordering Engine Tests (Task 0216)", () => {
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
    it("should successfully reorder steps moving up, shifts, and remaps all reply and branching references", async () => {
      let sequenceId = "";
      const stepIds: string[] = [];
      let templateId = "";
      let branchId = "";

      // 1. Seed active sequence, template, steps, and branches under Tenant A
      await withTenant(orgA, mockDb, async () => {
        const seq = await dbStore.marketingSequences.insert({
          orgId: orgA,
          name: "Sequence to reorder",
          description: "Reorder test",
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

        // Branch on Step 1: True goes to Step 3, False goes to Step 4
        const br = await dbStore.marketingSequenceStepBranches.insert({
          orgId: orgA,
          stepId: s1.id,
          branchType: "email_open",
          evaluationWindowDays: 3,
          trueNextStepNumber: 3,
          falseNextStepNumber: 4,
        });
        branchId = br.id;
      });

      // 2. Perform reorder: Move Step 4 to position 2
      const reorderRes = await app.request(
        `/api/sequences/${sequenceId}/steps/${stepIds[3]}/reorder`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${tokenTenantA}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ newStepNumber: 2 }),
        },
      );

      expect(reorderRes.status).toBe(200);
      const body = await reorderRes.json();
      expect(body.success).toBe(true);
      expect(body.steps).toHaveLength(4);

      // Verify the new step numbers of all steps in order
      const step1 = body.steps.find((s: { id: string }) => s.id === stepIds[0]);
      const step2 = body.steps.find((s: { id: string }) => s.id === stepIds[1]);
      const step3 = body.steps.find((s: { id: string }) => s.id === stepIds[2]);
      const step4 = body.steps.find((s: { id: string }) => s.id === stepIds[3]);

      expect(step1.stepNumber).toBe(1);
      expect(step4.stepNumber).toBe(2); // Old Step 4 becomes Step 2
      expect(step2.stepNumber).toBe(3); // Old Step 2 becomes Step 3
      expect(step3.stepNumber).toBe(4); // Old Step 3 becomes Step 4

      // Verify replyToStepNumber remapping
      // Old Step 3 (now stepNumber 4) replied to Old Step 2 (now stepNumber 3).
      // So step3.replyToStepNumber must become 3!
      expect(step3.replyToStepNumber).toBe(3);

      // Old Step 4 (now stepNumber 2) replied to Old Step 3 (now stepNumber 4).
      // So step4.replyToStepNumber must become 4!
      expect(step4.replyToStepNumber).toBe(4);

      // Verify branching references in DB
      await withTenant(orgA, mockDb, async () => {
        const br =
          await dbStore.marketingSequenceStepBranches.findOne(branchId);
        expect(br).toBeDefined();
        // True target was 3 (Old Step 3). Old Step 3 is now Step 4. So trueNextStepNumber must be 4.
        expect(br?.trueNextStepNumber).toBe(4);
        // False target was 4 (Old Step 4). Old Step 4 is now Step 2. So falseNextStepNumber must be 2.
        expect(br?.falseNextStepNumber).toBe(2);
      });
    });

    it("should successfully reorder steps moving down, shifts, and remaps references", async () => {
      let sequenceId = "";
      const stepIds: string[] = [];
      let templateId = "";

      // 1. Seed active sequence, template, and steps under Tenant A
      await withTenant(orgA, mockDb, async () => {
        const seq = await dbStore.marketingSequences.insert({
          orgId: orgA,
          name: "Sequence to reorder down",
          description: "Reorder down test",
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
        const s1 = await dbStore.marketingSequenceSteps.insert({
          orgId: orgA,
          sequenceId,
          stepNumber: 1,
          delayDays: 1,
          templateId,
        });
        const s2 = await dbStore.marketingSequenceSteps.insert({
          orgId: orgA,
          sequenceId,
          stepNumber: 2,
          delayDays: 1,
          templateId,
        });
        const s3 = await dbStore.marketingSequenceSteps.insert({
          orgId: orgA,
          sequenceId,
          stepNumber: 3,
          delayDays: 1,
          templateId,
          replyToStepNumber: 2,
        });
        const s4 = await dbStore.marketingSequenceSteps.insert({
          orgId: orgA,
          sequenceId,
          stepNumber: 4,
          delayDays: 1,
          templateId,
          replyToStepNumber: 3,
        });

        stepIds.push(s1.id, s2.id, s3.id, s4.id);
      });

      // 2. Perform reorder: Move Step 2 to position 4
      const reorderRes = await app.request(
        `/api/sequences/${sequenceId}/steps/${stepIds[1]}/reorder`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${tokenTenantA}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ newStepNumber: 4 }),
        },
      );

      expect(reorderRes.status).toBe(200);
      const body = await reorderRes.json();
      expect(body.success).toBe(true);

      const step1 = body.steps.find((s: { id: string }) => s.id === stepIds[0]);
      const step2 = body.steps.find((s: { id: string }) => s.id === stepIds[1]);
      const step3 = body.steps.find((s: { id: string }) => s.id === stepIds[2]);
      const step4 = body.steps.find((s: { id: string }) => s.id === stepIds[3]);

      expect(step1.stepNumber).toBe(1);
      expect(step3.stepNumber).toBe(2); // Old Step 3 becomes Step 2
      expect(step4.stepNumber).toBe(3); // Old Step 4 becomes Step 3
      expect(step2.stepNumber).toBe(4); // Old Step 2 becomes Step 4

      // Verify replyToStepNumber remapping
      // Old Step 3 (now Step 2) replied to Old Step 2 (now Step 4). So replyToStepNumber is 4.
      expect(step3.replyToStepNumber).toBe(4);
      // Old Step 4 (now Step 3) replied to Old Step 3 (now Step 2). So replyToStepNumber is 2.
      expect(step4.replyToStepNumber).toBe(2);
    });

    it("should prevent tenant RLS isolation breaches", async () => {
      let sequenceId = "";
      let stepId = "";

      await withTenant(orgA, mockDb, async () => {
        const seq = await dbStore.marketingSequences.insert({
          orgId: orgA,
          name: "Sequence to reorder down",
          description: "Reorder down test",
          status: "active",
        });
        sequenceId = seq.id;

        const tmpl = await dbStore.emailTemplates.insert({
          orgId: orgA,
          name: "Template A",
          subject: "Sub A",
          body: "Body A",
        });

        const s1 = await dbStore.marketingSequenceSteps.insert({
          orgId: orgA,
          sequenceId,
          stepNumber: 1,
          delayDays: 1,
          templateId: tmpl.id,
        });
        stepId = s1.id;
      });

      // Try to reorder using Tenant B's token
      const reorderRes = await app.request(
        `/api/sequences/${sequenceId}/steps/${stepId}/reorder`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${tokenTenantB}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ newStepNumber: 1 }),
        },
      );

      expect(reorderRes.status).toBe(404);
      const body = await reorderRes.json();
      expect(body.success).toBe(false);
      expect(body.error).toContain("Sequence not found");
    });

    it("should validate out of bounds step numbers", async () => {
      let sequenceId = "";
      let stepId = "";

      await withTenant(orgA, mockDb, async () => {
        const seq = await dbStore.marketingSequences.insert({
          orgId: orgA,
          name: "Sequence to reorder down",
          description: "Reorder down test",
          status: "active",
        });
        sequenceId = seq.id;

        const tmpl = await dbStore.emailTemplates.insert({
          orgId: orgA,
          name: "Template A",
          subject: "Sub A",
          body: "Body A",
        });

        const s1 = await dbStore.marketingSequenceSteps.insert({
          orgId: orgA,
          sequenceId,
          stepNumber: 1,
          delayDays: 1,
          templateId: tmpl.id,
        });
        stepId = s1.id;
      });

      // Try newStepNumber = 0 (out of bounds)
      const res0 = await app.request(
        `/api/sequences/${sequenceId}/steps/${stepId}/reorder`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${tokenTenantA}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ newStepNumber: 0 }),
        },
      );
      expect(res0.status).toBe(400);

      // Try newStepNumber = 2 (out of bounds since there's only 1 step)
      const res2 = await app.request(
        `/api/sequences/${sequenceId}/steps/${stepId}/reorder`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${tokenTenantA}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ newStepNumber: 2 }),
        },
      );
      expect(res2.status).toBe(400);
    });
  });
});
