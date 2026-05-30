import { createSessionToken } from "@crm/auth";
import { executePendingSequenceSteps } from "@crm/core";
import { dbStore, mockDb, withTenant } from "@crm/db";
import { beforeEach, describe, expect, it } from "vitest";
import { createTestApp } from "./_harness";

const app = createTestApp();

describe("Marketing Sequence Webhook Actions Tests (Task 0219)", () => {
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

  describe("API Endpoints & Validation Rules", () => {
    it("should allow creating a webhook step and skip template checking", async () => {
      // 1. Create a marketing sequence first
      let sequenceId = "";
      await withTenant(orgA, mockDb, async () => {
        const seq = await dbStore.marketingSequences.insert({
          orgId: orgA,
          name: "Webhook Outbound Sequence",
          status: "active",
          senderType: "system",
        });
        sequenceId = seq.id;
      });

      // 2. Create a webhook step via API
      const res = await app.request(`/api/sequences/${sequenceId}/steps`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenTenantA}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          stepNumber: 1,
          delayDays: 2,
          stepType: "webhook",
          webhookUrl: "https://api.external.com/v1/lead-trigger",
          webhookPayload: JSON.stringify({ custom: "lead-reached-step-1" }),
        }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.step.id).toBeDefined();
      expect(body.step.stepType).toBe("webhook");
      expect(body.step.webhookUrl).toBe(
        "https://api.external.com/v1/lead-trigger",
      );
      expect(body.step.webhookPayload).toContain("lead-reached-step-1");
      expect(body.step.templateId).toBeNull();
    });

    it("should enforce validation rules for step creation", async () => {
      let sequenceId = "";
      await withTenant(orgA, mockDb, async () => {
        const seq = await dbStore.marketingSequences.insert({
          orgId: orgA,
          name: "Sequence with Validation",
          status: "active",
          senderType: "system",
        });
        sequenceId = seq.id;
      });

      // 1. Webhook step missing webhookUrl -> 400
      const missingUrlRes = await app.request(
        `/api/sequences/${sequenceId}/steps`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${tokenTenantA}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            stepNumber: 1,
            stepType: "webhook",
          }),
        },
      );
      expect(missingUrlRes.status).toBe(400);

      // 2. Webhook step with invalid URL format -> 400
      const invalidUrlRes = await app.request(
        `/api/sequences/${sequenceId}/steps`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${tokenTenantA}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            stepNumber: 1,
            stepType: "webhook",
            webhookUrl: "ftp://invalid-protocol.com",
          }),
        },
      );
      expect(invalidUrlRes.status).toBe(400);

      // 3. Email step missing templateId -> 400
      const missingTemplateRes = await app.request(
        `/api/sequences/${sequenceId}/steps`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${tokenTenantA}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            stepNumber: 1,
            stepType: "email",
          }),
        },
      );
      expect(missingTemplateRes.status).toBe(400);

      // 4. Invalid stepType -> 400
      const invalidTypeRes = await app.request(
        `/api/sequences/${sequenceId}/steps`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${tokenTenantA}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            stepNumber: 1,
            stepType: "invalid_type",
          }),
        },
      );
      expect(invalidTypeRes.status).toBe(400);
    });
  });

  describe("Webhook Action Execution Engine", () => {
    it("should enqueue a webhookOutbox entry and advance sequence membership cleanly", async () => {
      let sequenceId = "";
      let leadId = "";

      await withTenant(orgA, mockDb, async () => {
        // 1. Create a Lead
        const lead = await dbStore.leads.insert({
          orgId: orgA,
          email: "target-lead@tenant-a.com",
          company: "Tenant A Lead Corp",
          status: "New",
        });
        leadId = lead.id;

        // 2. Create a Sequence
        const seq = await dbStore.marketingSequences.insert({
          orgId: orgA,
          name: "Lead Webhook Action Sequence",
          status: "active",
          senderType: "system",
        });
        sequenceId = seq.id;

        // 3. Create a Webhook Step
        await dbStore.marketingSequenceSteps.insert({
          orgId: orgA,
          sequenceId,
          stepNumber: 1,
          delayDays: 0,
          stepType: "webhook",
          webhookUrl: "https://webhooks.tenant-a.io/incoming",
          webhookPayload: JSON.stringify({
            event: "lead_step_1",
            email: "{{lead.email}}",
          }),
        });

        // 4. Enroll Lead in Sequence
        await dbStore.marketingSequenceMemberships.insert({
          orgId: orgA,
          sequenceId,
          recordType: "lead",
          recordId: leadId,
          status: "active",
          currentStepNumber: 0,
          nextExecutionAt: new Date(Date.now() - 10000), // Ready to execute
        });
      });

      // 5. Execute pending steps
      let processedCount = 0;
      await withTenant(orgA, mockDb, async () => {
        processedCount = await executePendingSequenceSteps(
          // biome-ignore lint/suspicious/noExplicitAny: dbStore cast is safe
          dbStore as any,
          new Date(),
        );
      });
      expect(processedCount).toBe(1);

      // 6. Assert webhookOutbox has been populated
      await withTenant(orgA, mockDb, async () => {
        const outbox = await dbStore.webhookOutbox.findMany();
        expect(outbox.length).toBe(1);
        expect(outbox[0].orgId).toBe(orgA);
        expect(outbox[0].status).toBe("pending");

        // Assert templating replaced {{lead.email}} in webhookPayload
        expect(outbox[0].payload).toContain("target-lead@tenant-a.com");
        expect(outbox[0].payload).toContain("lead_step_1");

        // Assert membership advanced to step 1 and completed (since there is no step 2)
        const memberships =
          await dbStore.marketingSequenceMemberships.findMany();
        expect(memberships.length).toBe(1);
        expect(memberships[0].currentStepNumber).toBe(1);
        expect(memberships[0].status).toBe("completed");

        // Assert audit log was generated
        const logs = await dbStore.auditLogs.findMany();
        expect(
          logs.some(
            (l) =>
              l.action === "execute_step" && l.recordId === memberships[0].id,
          ),
        ).toBe(true);
      });
    });

    it("should enforce strict tenant RLS isolation on execution and endpoints", async () => {
      let sequenceId = "";
      await withTenant(orgA, mockDb, async () => {
        const seq = await dbStore.marketingSequences.insert({
          orgId: orgA,
          name: "Private Tenant A Sequence",
          status: "active",
          senderType: "system",
        });
        sequenceId = seq.id;
      });

      // Tenant B should not be able to create a step on Tenant A's sequence
      const badStepRes = await app.request(
        `/api/sequences/${sequenceId}/steps`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${tokenTenantB}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            stepNumber: 1,
            stepType: "webhook",
            webhookUrl: "https://spying.com",
          }),
        },
      );
      // Should throw RLS error (404/500/etc based on route handler sequence check)
      expect(badStepRes.status).toBe(404); // sequence findOne returns null for mismatched tenant
    });
  });
});
