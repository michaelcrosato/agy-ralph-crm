import { createSessionToken } from "@crm/auth";
import { executePendingSequenceSteps } from "@crm/core";
import { dbStore, mockDb, withTenant } from "@crm/db";
import { beforeEach, describe, expect, it } from "vitest";
import app from "../../../apps/api/src/index";

describe("Marketing Sequence Reply Actions Engine Tests (Task 0199)", () => {
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

  it("should configure, trigger, and execute reply actions with strict tenant RLS isolation and auto-completion", async () => {
    let seqId = "";
    let stepId = "";
    let leadId = "";
    let templateId = "";

    // 1. Setup sequence, step, lead under Tenant A
    await withTenant(orgA, mockDb, async () => {
      const seq = await dbStore.marketingSequences.insert({
        orgId: orgA,
        name: "Reply Journey",
        description: "Testing sequence reply triggers",
        status: "active",
      });
      seqId = seq.id;

      const template = await dbStore.emailTemplates.insert({
        orgId: orgA,
        name: "Welcome Email",
        subject: "Welcome to our company: {{lead.company}}",
        body: "Hey, hope you reply to this email!",
      });
      templateId = template.id;

      const step = await dbStore.marketingSequenceSteps.insert({
        orgId: orgA,
        sequenceId: seqId,
        stepNumber: 1,
        delayDays: 0,
        templateId,
      });
      stepId = step.id;

      await dbStore.marketingSequenceSteps.insert({
        orgId: orgA,
        sequenceId: seqId,
        stepNumber: 2,
        delayDays: 2,
        templateId,
      });

      const lead = await dbStore.leads.insert({
        orgId: orgA,
        ownerId: "user-a",
        status: "New",
        email: "bob@example.com",
        company: "Bob Corp",
        convertedAccountId: null,
        convertedContactId: null,
        custom: { timezone: "America/Los_Angeles" },
      });
      leadId = lead.id;
    });

    // 2. Configure reply actions via API under Tenant A
    const postRes1 = await app.request(
      `/api/sequences/steps/${stepId}/reply-actions`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenTenantA}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          actionType: "field_update",
          actionConfig: {
            field: "status",
            value: "Working",
          },
        }),
      },
    );
    expect(postRes1.status).toBe(200);

    const postRes2 = await app.request(
      `/api/sequences/steps/${stepId}/reply-actions`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenTenantA}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          actionType: "create_task",
          actionConfig: {
            subject: "Prospect replied to welcome email",
            body: "Call them back immediately!",
            dueDateOffsetDays: 1,
          },
        }),
      },
    );
    expect(postRes2.status).toBe(200);

    // 3. Verify reply actions are configured correctly via API
    const getRes = await app.request(
      `/api/sequences/steps/${stepId}/reply-actions`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${tokenTenantA}`,
        },
      },
    );
    expect(getRes.status).toBe(200);
    const getData = await getRes.json();
    expect(getData.data.length).toBe(2);

    // 4. Enroll the lead and execute sequence step
    await withTenant(orgA, mockDb, async () => {
      await dbStore.marketingSequenceMemberships.insert({
        orgId: orgA,
        sequenceId: seqId,
        recordType: "lead",
        recordId: leadId,
        status: "active",
        currentStepNumber: 0,
        nextExecutionAt: new Date(),
        lastExecutedAt: null,
      });

      const processed = await executePendingSequenceSteps(dbStore);
      expect(processed).toBe(1);

      // Verify email tracker was created
      const trackers = await dbStore.emailTrackers.findMany();
      expect(trackers.length).toBe(1);
      const tracker = trackers[0];

      // Verify membership is active before reply
      const membershipsBefore =
        await dbStore.marketingSequenceMemberships.findMany();
      expect(membershipsBefore[0].status).toBe("active");

      // 5. Simulate email reply event via Hono REST API track reply endpoint
      const replyRes = await app.request(
        `/api/public/emails/track/reply/${tracker.token}`,
        {
          method: "POST",
        },
      );
      expect(replyRes.status).toBe(200);

      // 6. Assert reply actions were triggered and executed successfully
      const lead = await dbStore.leads.findOne(leadId);
      expect(lead?.status).toBe("Working");

      // Verify membership auto-completed upon reply
      const membershipsAfter =
        await dbStore.marketingSequenceMemberships.findMany();
      expect(membershipsAfter[0].status).toBe("completed");

      const activities = await dbStore.activities.findMany();
      // One email activity from step execution, and one task activity from reply action trigger
      expect(activities.length).toBe(2);
      const task = activities.find((act) => act.type === "task");
      expect(task).toBeDefined();
      expect(task?.subject).toBe("Prospect replied to welcome email");
      expect(task?.body).toBe("Call them back immediately!");

      // Verify task activity link is linked to lead
      const links = await dbStore.activityLinks.findMany();
      const taskLink = links.find((l) => l.activityId === task?.id);
      expect(taskLink).toBeDefined();
      expect(taskLink?.targetId).toBe(leadId);
      expect(taskLink?.targetType).toBe("Lead");

      // Verify audit logs were written
      const auditLogs = await dbStore.auditLogs.findMany();
      const autoCompletedAudit = auditLogs.find(
        (log) => log.action === "membership_auto_completed_on_reply",
      );
      expect(autoCompletedAudit).toBeDefined();
      expect(autoCompletedAudit?.recordType).toBe(
        "marketing_sequence_memberships",
      );

      const replyTriggerAudit = auditLogs.find(
        (log) => log.action === "reply_trigger_executed",
      );
      expect(replyTriggerAudit).toBeDefined();
      expect(replyTriggerAudit?.recordType).toBe(
        "marketing_sequence_memberships",
      );
    });

    // 7. Strict Tenant RLS Isolation check
    // Tenant B attempts to list Tenant A's reply actions -> expect 0 items due to RLS findMany filter
    const badGetRes = await app.request(
      `/api/sequences/steps/${stepId}/reply-actions`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${tokenTenantB}`,
        },
      },
    );
    expect(badGetRes.status).toBe(200);
    const badGetData = await badGetRes.json();
    expect(badGetData.data.length).toBe(0);

    // Tenant B attempts to delete Tenant A's reply actions -> expect 500/unauthorized Error
    const actionId = getData.data[0].id;
    const badDeleteRes = await app.request(
      `/api/sequences/steps/reply-actions/${actionId}`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${tokenTenantB}`,
        },
      },
    );
    expect(badDeleteRes.status).toBe(500);
  });
});
