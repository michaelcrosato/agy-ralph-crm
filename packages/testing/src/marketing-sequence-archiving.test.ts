import { createSessionToken } from "@crm/auth";
import { enrollInSequence } from "@crm/core";
import { dbStore, mockDb, withTenant } from "@crm/db";
import { beforeEach, describe, expect, it } from "vitest";
import { createTestApp } from "./_harness";

const app = createTestApp();

describe("Marketing Sequence Archiving & Deletion Engine Tests (Task 0214)", () => {
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
    it("should successfully archive a sequence and auto-complete active/paused memberships", async () => {
      let sequenceId = "";
      let activeMemId = "";
      let pausedMemId = "";
      let completedMemId = "";

      // Seed data under Tenant A
      await withTenant(orgA, mockDb, async () => {
        const seq = await dbStore.marketingSequences.insert({
          orgId: orgA,
          name: "Active campaign to archive",
          description: "Archive test",
          status: "active",
        });
        sequenceId = seq.id;

        // Seed steps so memberships have valid references
        await dbStore.marketingSequenceSteps.insert({
          orgId: orgA,
          sequenceId: seq.id,
          stepNumber: 1,
          delayDays: 1,
          templateId: "tpl-1",
        });

        const activeMem = await dbStore.marketingSequenceMemberships.insert({
          orgId: orgA,
          sequenceId: seq.id,
          recordType: "lead",
          recordId: "lead-active",
          status: "active",
          stepNumber: 1,
        });
        activeMemId = activeMem.id;

        const pausedMem = await dbStore.marketingSequenceMemberships.insert({
          orgId: orgA,
          sequenceId: seq.id,
          recordType: "contact",
          recordId: "contact-paused",
          status: "paused",
          stepNumber: 1,
        });
        pausedMemId = pausedMem.id;

        const completedMem = await dbStore.marketingSequenceMemberships.insert({
          orgId: orgA,
          sequenceId: seq.id,
          recordType: "lead",
          recordId: "lead-completed",
          status: "completed",
          stepNumber: 1,
        });
        completedMemId = completedMem.id;
      });

      // Archive sequence via API
      const res = await app.request(`/api/sequences/${sequenceId}/archive`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenTenantA}`,
        },
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.sequence.status).toBe("archived");

      // Verify statuses in db
      await withTenant(orgA, mockDb, async () => {
        const seq = await dbStore.marketingSequences.findOne(sequenceId);
        expect(seq?.status).toBe("archived");

        const mActive =
          await dbStore.marketingSequenceMemberships.findOne(activeMemId);
        expect(mActive?.status).toBe("completed");

        const mPaused =
          await dbStore.marketingSequenceMemberships.findOne(pausedMemId);
        expect(mPaused?.status).toBe("completed");

        const mCompleted =
          await dbStore.marketingSequenceMemberships.findOne(completedMemId);
        expect(mCompleted?.status).toBe("completed"); // Unchanged
      });
    });

    it("should prevent new enrollments to archived sequences", async () => {
      let sequenceId = "";
      let leadId = "";

      await withTenant(orgA, mockDb, async () => {
        const seq = await dbStore.marketingSequences.insert({
          orgId: orgA,
          name: "Archived Campaign",
          description: "Archive test",
          status: "archived",
        });
        sequenceId = seq.id;

        await dbStore.marketingSequenceSteps.insert({
          orgId: orgA,
          sequenceId: seq.id,
          stepNumber: 1,
          delayDays: 1,
          templateId: "tpl-1",
        });

        const lead = await dbStore.leads.insert({
          orgId: orgA,
          ownerId: "user-a",
          status: "New",
          email: "test@example.com",
          company: "Test Co",
        });
        leadId = lead.id;
      });

      // Try enrolling should throw
      await expect(
        withTenant(orgA, mockDb, async () => {
          await enrollInSequence(
            // biome-ignore lint/suspicious/noExplicitAny: test mock dbStore
            dbStore as any,
            orgA,
            sequenceId,
            "lead",
            leadId,
          );
        }),
      ).rejects.toThrow("Cannot enroll in an archived sequence");
    });

    it("should successfully purge an archived sequence and all child components", async () => {
      let sequenceId = "";
      let stepId = "";
      let branchId = "";
      let testId = "";
      let actionId = "";
      let triggerId = "";
      let mappingId = "";
      let membershipId = "";

      await withTenant(orgA, mockDb, async () => {
        const seq = await dbStore.marketingSequences.insert({
          orgId: orgA,
          name: "Archived Campaign to Purge",
          description: "Archive test",
          status: "archived",
        });
        sequenceId = seq.id;

        const step = await dbStore.marketingSequenceSteps.insert({
          orgId: orgA,
          sequenceId: seq.id,
          stepNumber: 1,
          delayDays: 1,
          templateId: "tpl-1",
        });
        stepId = step.id;

        const branch = await dbStore.marketingSequenceStepBranches.insert({
          orgId: orgA,
          stepId: step.id,
          branchType: "email_open",
          evaluationWindowDays: 2,
          trueNextStepNumber: 2,
          falseNextStepNumber: 3,
        });
        branchId = branch.id;

        const splitTest = await dbStore.marketingSequenceStepSplitTests.insert({
          orgId: orgA,
          stepId: step.id,
          variantTemplateId: "tpl-2",
          splitWeight: 50,
          isActive: 1,
        });
        testId = splitTest.id;

        const openAction = await dbStore.marketingSequenceOpenActions.insert({
          orgId: orgA,
          stepId: step.id,
          actionType: "field_update",
          actionConfig: { field: "status", value: "Engaged" },
        });
        actionId = openAction.id;

        const trigger = await dbStore.marketingSequenceExitTriggers.insert({
          orgId: orgA,
          sequenceId: seq.id,
          triggerType: "field_change",
          criteria: { field: "status", value: "Customer" },
          isActive: true,
        });
        triggerId = trigger.id;

        const tag = await dbStore.marketingSequenceTags.insert({
          orgId: orgA,
          name: "ArchiveTag",
          color: "#ff0000",
        });

        const mapping = await dbStore.marketingSequenceTagMappings.insert({
          orgId: orgA,
          sequenceId: seq.id,
          tagId: tag.id,
        });
        mappingId = mapping.id;

        const membership = await dbStore.marketingSequenceMemberships.insert({
          orgId: orgA,
          sequenceId: seq.id,
          recordType: "lead",
          recordId: "lead-purge",
          status: "completed",
          stepNumber: 1,
        });
        membershipId = membership.id;
      });

      // Purge via API
      const res = await app.request(`/api/sequences/${sequenceId}/purge`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${tokenTenantA}`,
        },
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.message).toBe("Sequence purged successfully");

      // Verify cascade deletion in db
      await withTenant(orgA, mockDb, async () => {
        expect(await dbStore.marketingSequences.findOne(sequenceId)).toBeNull();
        expect(await dbStore.marketingSequenceSteps.findOne(stepId)).toBeNull();
        expect(
          await dbStore.marketingSequenceStepBranches.findOne(branchId),
        ).toBeNull();
        expect(
          await dbStore.marketingSequenceStepSplitTests.findOne(testId),
        ).toBeNull();
        expect(
          await dbStore.marketingSequenceOpenActions.findOne(actionId),
        ).toBeNull();
        expect(
          await dbStore.marketingSequenceExitTriggers.findOne(triggerId),
        ).toBeNull();
        expect(
          await dbStore.marketingSequenceTagMappings.findOne(mappingId),
        ).toBeNull();
        expect(
          await dbStore.marketingSequenceMemberships.findOne(membershipId),
        ).toBeNull();
      });
    });

    it("should prevent purging a sequence that is not archived", async () => {
      let sequenceId = "";

      await withTenant(orgA, mockDb, async () => {
        const seq = await dbStore.marketingSequences.insert({
          orgId: orgA,
          name: "Draft Campaign",
          description: "Archive test",
          status: "draft",
        });
        sequenceId = seq.id;
      });

      // Attempt to purge via API
      const res = await app.request(`/api/sequences/${sequenceId}/purge`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${tokenTenantA}`,
        },
      });

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.success).toBe(false);
      expect(body.error).toBe("Only archived sequences can be purged");
    });

    it("should enforce tenant isolation (RLS) for archive and purge operations", async () => {
      let sequenceId = "";

      await withTenant(orgA, mockDb, async () => {
        const seq = await dbStore.marketingSequences.insert({
          orgId: orgA,
          name: "Tenant A Campaign",
          description: "Archive test",
          status: "active",
        });
        sequenceId = seq.id;
      });

      // Tenant B tries to archive Tenant A's sequence -> should return 404
      const resArchive = await app.request(
        `/api/sequences/${sequenceId}/archive`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${tokenTenantB}`,
          },
        },
      );

      expect(resArchive.status).toBe(404);

      // Archive sequence properly first using Tenant A
      await app.request(`/api/sequences/${sequenceId}/archive`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenTenantA}`,
        },
      });

      // Tenant B tries to purge Tenant A's sequence -> should return 404
      const resPurge = await app.request(`/api/sequences/${sequenceId}/purge`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${tokenTenantB}`,
        },
      });

      expect(resPurge.status).toBe(404);
    });
  });
});
