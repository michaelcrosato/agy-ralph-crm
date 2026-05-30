import { createSessionToken } from "@crm/auth";
import { executePendingSequenceSteps } from "@crm/core";
import { dbStore, mockDb, withTenant } from "@crm/db";
import { beforeEach, describe, expect, it } from "vitest";
import { createTestApp } from "./_harness";

const app = createTestApp();

describe("Marketing Sequence Call Actions Tests (Task 0222)", () => {
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
    it("should allow creating a Call step via API", async () => {
      let sequenceId = "";
      await withTenant(orgA, mockDb, async () => {
        const seq = await dbStore.marketingSequences.insert({
          orgId: orgA,
          name: "Call Follow-up Sequence",
          status: "active",
          senderType: "system",
        });
        sequenceId = seq.id;
      });

      const res = await app.request(`/api/sequences/${sequenceId}/steps`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenTenantA}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          stepNumber: 1,
          delayDays: 1,
          stepType: "call",
          callScript: "Hello {{lead.email}}, welcome to tenant A!",
        }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.step.id).toBeDefined();
      expect(body.step.stepType).toBe("call");
      expect(body.step.callScript).toBe(
        "Hello {{lead.email}}, welcome to tenant A!",
      );
    });

    it("should enforce validation rules for Call step creation", async () => {
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

      // Call step missing callScript -> 400
      const missingMsgRes = await app.request(
        `/api/sequences/${sequenceId}/steps`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${tokenTenantA}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            stepNumber: 1,
            stepType: "call",
          }),
        },
      );
      expect(missingMsgRes.status).toBe(400);
    });

    it("should block Tenant B from adding Call steps to Tenant A's sequence", async () => {
      let sequenceId = "";
      await withTenant(orgA, mockDb, async () => {
        const seq = await dbStore.marketingSequences.insert({
          orgId: orgA,
          name: "Tenant A Sequence",
          status: "active",
          senderType: "system",
        });
        sequenceId = seq.id;
      });

      const res = await app.request(`/api/sequences/${sequenceId}/steps`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenTenantB}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          stepNumber: 1,
          stepType: "call",
          callScript: "Malicious template",
        }),
      });

      expect(res.status).toBe(404);
    });
  });

  describe("Call Action Execution Engine & Personalization", () => {
    it("should generate a personalized CRM Call activity and link it to the Lead cleanly", async () => {
      let sequenceId = "";
      let leadId = "";

      await withTenant(orgA, mockDb, async () => {
        // 1. Create a Lead with ownerId and custom info
        const lead = await dbStore.leads.insert({
          orgId: orgA,
          email: "sales-lead@tenant-a.com",
          company: "Acme Sales Corp",
          status: "New",
          ownerId: "user-a",
        });
        leadId = lead.id;

        // 2. Create a Sequence
        const seq = await dbStore.marketingSequences.insert({
          orgId: orgA,
          name: "Personalized Call Sequence",
          status: "active",
          senderType: "system",
        });
        sequenceId = seq.id;

        // 3. Create a Call Step with dynamic recipient personalization tags
        await dbStore.marketingSequenceSteps.insert({
          orgId: orgA,
          sequenceId,
          stepNumber: 1,
          delayDays: 0,
          stepType: "call",
          callScript: "Hello {{lead.email}} at {{lead.company}}!",
        });

        // 4. Enroll Lead in the Sequence
        await dbStore.marketingSequenceMemberships.insert({
          orgId: orgA,
          sequenceId,
          recordType: "lead",
          recordId: leadId,
          status: "active",
          currentStepNumber: 0,
          nextExecutionAt: new Date(Date.now() - 10000), // past execution date
          lastExecutedAt: null,
          snoozeUntil: null,
          snoozeReason: null,
        });
      });

      // 5. Run the core processing engine
      await withTenant(orgA, mockDb, async () => {
        const processedCount = await executePendingSequenceSteps(
          dbStore,
          new Date(),
        );
        expect(processedCount).toBe(1);

        // 6. Assert that CRM activity of type 'call' was created correctly
        const activities = await dbStore.activities.findMany();
        expect(activities.length).toBe(1);
        const act = activities[0];
        expect(act.type).toBe("call");
        expect(act.subject).toBe("Outbound Call");
        expect(act.body).toBe(
          "Hello sales-lead@tenant-a.com at Acme Sales Corp!",
        );
        expect(act.creatorId).toBe("00000000-0000-0000-0000-000000000000");
        expect(act.orgId).toBe(orgA);

        // Check activityLinks
        const links = await dbStore.activityLinks.findMany();
        expect(links.length).toBe(1);
        expect(links[0].activityId).toBe(act.id);
        expect(links[0].targetType).toBe("Lead");
        expect(links[0].targetId).toBe(leadId);

        // Verify sequence membership advanced
        const memberships =
          await dbStore.marketingSequenceMemberships.findMany();
        expect(memberships[0].currentStepNumber).toBe(1);
        expect(memberships[0].status).toBe("completed");
      });
    });

    it("should assert strict tenant RLS isolation on executed Call steps and CRM activities", async () => {
      let seqA = "";
      let seqB = "";
      let leadA = "";
      let leadB = "";

      // Setup Tenant A
      await withTenant(orgA, mockDb, async () => {
        const lead = await dbStore.leads.insert({
          orgId: orgA,
          email: "lead@tenant-a.com",
          company: "Tenant A Company",
          status: "New",
        });
        leadA = lead.id;

        const seq = await dbStore.marketingSequences.insert({
          orgId: orgA,
          name: "Sequence A",
          status: "active",
          senderType: "system",
        });
        seqA = seq.id;

        await dbStore.marketingSequenceSteps.insert({
          orgId: orgA,
          sequenceId: seqA,
          stepNumber: 1,
          delayDays: 0,
          stepType: "call",
          callScript: "Tenant A Call script",
        });

        await dbStore.marketingSequenceMemberships.insert({
          orgId: orgA,
          sequenceId: seqA,
          recordType: "lead",
          recordId: leadA,
          status: "active",
          currentStepNumber: 0,
          nextExecutionAt: new Date(Date.now() - 10000),
          lastExecutedAt: null,
          snoozeUntil: null,
          snoozeReason: null,
        });
      });

      // Setup Tenant B
      await withTenant(orgB, mockDb, async () => {
        const lead = await dbStore.leads.insert({
          orgId: orgB,
          email: "lead@tenant-b.com",
          company: "Tenant B Company",
          status: "New",
        });
        leadB = lead.id;

        const seq = await dbStore.marketingSequences.insert({
          orgId: orgB,
          name: "Sequence B",
          status: "active",
          senderType: "system",
        });
        seqB = seq.id;

        await dbStore.marketingSequenceSteps.insert({
          orgId: orgB,
          sequenceId: seqB,
          stepNumber: 1,
          delayDays: 0,
          stepType: "call",
          callScript: "Tenant B Call script",
        });

        await dbStore.marketingSequenceMemberships.insert({
          orgId: orgB,
          sequenceId: seqB,
          recordType: "lead",
          recordId: leadB,
          status: "active",
          currentStepNumber: 0,
          nextExecutionAt: new Date(Date.now() - 10000),
          lastExecutedAt: null,
          snoozeUntil: null,
          snoozeReason: null,
        });
      });

      // Execute steps under Tenant A context
      await withTenant(orgA, mockDb, async () => {
        const count = await executePendingSequenceSteps(dbStore, new Date());
        expect(count).toBe(1);

        // Verify only Tenant A activity exists in Tenant A context
        const activities = await dbStore.activities.findMany();
        expect(activities.length).toBe(1);
        expect(activities[0].body).toBe("Tenant A Call script");
        expect(activities[0].orgId).toBe(orgA);
      });

      // Execute steps under Tenant B context
      await withTenant(orgB, mockDb, async () => {
        const count = await executePendingSequenceSteps(dbStore, new Date());
        expect(count).toBe(1);

        // Verify only Tenant B activity exists in Tenant B context
        const activities = await dbStore.activities.findMany();
        expect(activities.length).toBe(1);
        expect(activities[0].body).toBe("Tenant B Call script");
        expect(activities[0].orgId).toBe(orgB);
      });
    });
  });
});
