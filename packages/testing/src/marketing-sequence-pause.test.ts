import { createSessionToken } from "@crm/auth";
import { executePendingSequenceSteps } from "@crm/core";
import { dbStore, mockDb, withTenant } from "@crm/db";
import { beforeEach, describe, expect, it } from "vitest";
import app from "../../../apps/api/src/index";

describe("Marketing Sequence Pause & Resume Engine Tests (Task 0215)", () => {
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
    it("should successfully pause an active sequence and resume a paused sequence", async () => {
      let sequenceId = "";

      // 1. Seed active sequence under Tenant A
      await withTenant(orgA, mockDb, async () => {
        const seq = await dbStore.marketingSequences.insert({
          orgId: orgA,
          name: "Sequence to pause",
          description: "Pause test",
          status: "active",
        });
        sequenceId = seq.id;
      });

      // 2. Pause sequence as Tenant A
      const pauseRes = await app.request(`/api/sequences/${sequenceId}/pause`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenTenantA}`,
        },
      });

      expect(pauseRes.status).toBe(200);
      const pauseBody = await pauseRes.json();
      expect(pauseBody.success).toBe(true);
      expect(pauseBody.sequence.status).toBe("paused");

      // Verify DB state
      await withTenant(orgA, mockDb, async () => {
        const seq = await dbStore.marketingSequences.findOne(sequenceId);
        expect(seq?.status).toBe("paused");
      });

      // 3. Resume sequence as Tenant A
      const resumeRes = await app.request(
        `/api/sequences/${sequenceId}/resume`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${tokenTenantA}`,
          },
        },
      );

      expect(resumeRes.status).toBe(200);
      const resumeBody = await resumeRes.json();
      expect(resumeBody.success).toBe(true);
      expect(resumeBody.sequence.status).toBe("active");

      // Verify DB state
      await withTenant(orgA, mockDb, async () => {
        const seq = await dbStore.marketingSequences.findOne(sequenceId);
        expect(seq?.status).toBe("active");
      });
    });

    it("should reject pause on draft or archived sequence", async () => {
      let draftSeqId = "";

      await withTenant(orgA, mockDb, async () => {
        const seq = await dbStore.marketingSequences.insert({
          orgId: orgA,
          name: "Draft sequence",
          description: "Draft test",
          status: "draft",
        });
        draftSeqId = seq.id;
      });

      const pauseRes = await app.request(`/api/sequences/${draftSeqId}/pause`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenTenantA}`,
        },
      });

      expect(pauseRes.status).toBe(400);
      const pauseBody = await pauseRes.json();
      expect(pauseBody.success).toBe(false);
      expect(pauseBody.error).toBe("Only active sequences can be paused");
    });

    it("should reject resume on active sequence", async () => {
      let activeSeqId = "";

      await withTenant(orgA, mockDb, async () => {
        const seq = await dbStore.marketingSequences.insert({
          orgId: orgA,
          name: "Active sequence",
          description: "Active test",
          status: "active",
        });
        activeSeqId = seq.id;
      });

      const resumeRes = await app.request(
        `/api/sequences/${activeSeqId}/resume`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${tokenTenantA}`,
          },
        },
      );

      expect(resumeRes.status).toBe(400);
      const resumeBody = await resumeRes.json();
      expect(resumeBody.success).toBe(false);
      expect(resumeBody.error).toBe("Only paused sequences can be resumed");
    });

    it("should enforce RLS isolation and prevent a tenant from pausing/resuming another tenant's sequence", async () => {
      let sequenceId = "";

      await withTenant(orgA, mockDb, async () => {
        const seq = await dbStore.marketingSequences.insert({
          orgId: orgA,
          name: "Tenant A Sequence",
          status: "active",
        });
        sequenceId = seq.id;
      });

      // Tenant B tries to pause Tenant A's sequence
      const pauseResB = await app.request(
        `/api/sequences/${sequenceId}/pause`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${tokenTenantB}`,
          },
        },
      );

      expect(pauseResB.status).toBe(404); // RLS prevents visibility/action, returns not found

      // Pause it correctly as Tenant A
      await app.request(`/api/sequences/${sequenceId}/pause`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenTenantA}`,
        },
      });

      // Tenant B tries to resume Tenant A's sequence
      const resumeResB = await app.request(
        `/api/sequences/${sequenceId}/resume`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${tokenTenantB}`,
          },
        },
      );

      expect(resumeResB.status).toBe(404);
    });

    it("should skip membership step execution when the sequence is paused, and run normally when resumed", async () => {
      let sequenceId = "";
      let membershipId = "";

      await withTenant(orgA, mockDb, async () => {
        const seq = await dbStore.marketingSequences.insert({
          orgId: orgA,
          name: "Bypass Campaign",
          status: "active",
        });
        sequenceId = seq.id;

        const tpl = await dbStore.emailTemplates.insert({
          orgId: orgA,
          name: "Welcome",
          subject: "Welcome",
          body: "Hello",
        });

        await dbStore.marketingSequenceSteps.insert({
          orgId: orgA,
          sequenceId: seq.id,
          stepNumber: 1,
          delayDays: 0,
          templateId: tpl.id,
        });

        await dbStore.leads.insert({
          id: "lead-1",
          orgId: orgA,
          ownerId: "user-a",
          status: "new",
          email: "lead@example.com",
          company: "Example Inc",
        });

        const mem = await dbStore.marketingSequenceMemberships.insert({
          orgId: orgA,
          sequenceId: seq.id,
          recordType: "lead",
          recordId: "lead-1",
          status: "active",
          stepNumber: 0,
          currentStepNumber: 0,
          nextExecutionAt: new Date("2026-05-01T00:00:00Z"),
        });
        membershipId = mem.id;
      });

      // 1. Pause the sequence
      await app.request(`/api/sequences/${sequenceId}/pause`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenTenantA}`,
        },
      });

      // 2. Trigger step execution
      await withTenant(orgA, mockDb, async () => {
        const processed = await executePendingSequenceSteps(
          // biome-ignore lint/suspicious/noExplicitAny: mock dbStore type casting
          dbStore as any,
          new Date("2026-05-29T12:00:00Z"),
        );
        expect(processed).toBe(0); // Bypassed

        // Verify membership did not change status or step number
        const mem =
          await dbStore.marketingSequenceMemberships.findOne(membershipId);
        expect(mem?.currentStepNumber).toBe(0);
        expect(mem?.status).toBe("active");
      });

      // 3. Resume the sequence
      await app.request(`/api/sequences/${sequenceId}/resume`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenTenantA}`,
        },
      });

      // 4. Trigger step execution again
      await withTenant(orgA, mockDb, async () => {
        const processed = await executePendingSequenceSteps(
          // biome-ignore lint/suspicious/noExplicitAny: mock dbStore type casting
          dbStore as any,
          new Date("2026-05-29T12:00:00Z"),
        );
        expect(processed).toBe(1); // Executed successfully!

        const mem =
          await dbStore.marketingSequenceMemberships.findOne(membershipId);
        expect(mem?.currentStepNumber).toBe(1);
      });
    });
  });
});
