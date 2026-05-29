import { createSessionToken } from "@crm/auth";
import { executePendingSequenceSteps } from "@crm/core";
import { dbStore, mockDb, withTenant } from "@crm/db";
import { beforeEach, describe, expect, it } from "vitest";
import app from "../../../apps/api/src/index";

describe("Marketing Sequence Open Actions Engine Tests (Task 0198)", () => {
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

  it("should configure, trigger, and execute open actions with strict tenant RLS isolation", async () => {
    let seqId = "";
    let stepId = "";
    let leadId = "";
    let templateId = "";

    // 1. Setup sequence, step, lead under Tenant A
    await withTenant(orgA, mockDb, async () => {
      const seq = await dbStore.marketingSequences.insert({
        orgId: orgA,
        name: "Demo Journey",
        description: "Testing sequence open triggers",
        status: "active",
      });
      seqId = seq.id;

      const template = await dbStore.emailTemplates.insert({
        orgId: orgA,
        name: "Day 1 Welcome",
        subject: "Welcome to our company: {{lead.company}}",
        body: "Hey, hope you open this email!",
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

      const lead = await dbStore.leads.insert({
        orgId: orgA,
        ownerId: "user-a",
        status: "New",
        email: "alice@example.com",
        company: "Alice Corp",
        convertedAccountId: null,
        convertedContactId: null,
        custom: { timezone: "America/Los_Angeles" },
      });
      leadId = lead.id;
    });

    // 2. Configure open actions via API under Tenant A
    const postRes1 = await app.request(
      `/api/sequences/steps/${stepId}/open-actions`,
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
      `/api/sequences/steps/${stepId}/open-actions`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenTenantA}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          actionType: "create_task",
          actionConfig: {
            subject: "Prospect opened welcome email",
            body: "Perform follow-up immediately!",
            dueDateOffsetDays: 1,
          },
        }),
      },
    );
    expect(postRes2.status).toBe(200);

    // 3. Verify open actions are configured correctly via API
    const getRes = await app.request(
      `/api/sequences/steps/${stepId}/open-actions`,
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

      // 5. Simulate email open event via Hono REST API track open endpoint
      const openRes = await app.request(
        `/api/public/emails/track/open/${tracker.token}`,
        {
          method: "GET",
        },
      );
      expect(openRes.status).toBe(200);
      expect(openRes.headers.get("content-type")).toBe("image/gif");

      // 6. Assert open actions were triggered and executed successfully
      const lead = await dbStore.leads.findOne(leadId);
      expect(lead?.status).toBe("Working");

      const activities = await dbStore.activities.findMany();
      // One email activity from step execution, and one task activity from open action trigger
      expect(activities.length).toBe(2);
      const task = activities.find((act) => act.type === "task");
      expect(task).toBeDefined();
      expect(task?.subject).toBe("Prospect opened welcome email");
      expect(task?.body).toBe("Perform follow-up immediately!");

      // Verify task activity link is linked to lead
      const links = await dbStore.activityLinks.findMany();
      const taskLink = links.find((l) => l.activityId === task?.id);
      expect(taskLink).toBeDefined();
      expect(taskLink?.targetId).toBe(leadId);
      expect(taskLink?.targetType).toBe("Lead");

      // Verify audit logs were written
      const auditLogs = await dbStore.auditLogs.findMany();
      const openTriggerAudit = auditLogs.find(
        (log) => log.action === "open_trigger_executed",
      );
      expect(openTriggerAudit).toBeDefined();
      expect(openTriggerAudit?.recordType).toBe(
        "marketing_sequence_memberships",
      );
    });

    // 7. Strict Tenant RLS Isolation check
    // Tenant B attempts to list Tenant A's open actions -> expect 0 items due to RLS findMany filter
    const badGetRes = await app.request(
      `/api/sequences/steps/${stepId}/open-actions`,
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

    // Tenant B attempts to delete Tenant A's open actions -> expect 404
    const actionId = getData.data[0].id;
    const badDeleteRes = await app.request(
      `/api/sequences/steps/open-actions/${actionId}`,
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
