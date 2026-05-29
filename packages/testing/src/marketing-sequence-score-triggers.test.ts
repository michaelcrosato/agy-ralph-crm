import { createSessionToken } from "@crm/auth";
import { dbStore, mockDb, withTenant } from "@crm/db";
import { beforeEach, describe, expect, it } from "vitest";
import app from "../../../apps/api/src/index";

describe("Marketing Sequence Score-Based Automation Triggers Engine Tests (Task 0209)", () => {
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

  it("should support CRUD of score triggers, enforce active tenant RLS, and execute lead status, auto-exit, and task notification triggers correctly", async () => {
    let seqAId = "";
    let leadAId = "";
    let membershipAId = "";

    // 1. Setup Tenant A Data
    await withTenant(orgA, mockDb, async () => {
      // Create Sequence
      const seq = await dbStore.marketingSequences.insert({
        orgId: orgA,
        name: "Premium Nurture Campaign",
        description: "Testing score triggers",
        status: "active",
      });
      seqAId = seq.id;

      // Create Lead
      const lead = await dbStore.leads.insert({
        orgId: orgA,
        ownerId: "user-a",
        status: "New",
        email: "lead_a@example.com",
        company: "Acme Corp",
        convertedAccountId: null,
        convertedContactId: null,
        custom: null,
      });
      leadAId = lead.id;

      // Create Membership
      const membership = await dbStore.marketingSequenceMemberships.insert({
        orgId: orgA,
        sequenceId: seq.id,
        recordType: "lead",
        recordId: lead.id,
        status: "active",
        currentStepNumber: 1,
        engagementScore: 0,
      });
      membershipAId = membership.id;

      // Email activities and trackers
      const act = await dbStore.activities.insert({
        orgId: orgA,
        creatorId: "user-a",
        type: "email",
        subject: "Introduction to Acme",
        body: "Hello!",
        dueDate: null,
      });

      await dbStore.activityLinks.insert({
        orgId: orgA,
        activityId: act.id,
        targetType: "Lead",
        targetId: lead.id,
      });

      await dbStore.emailTrackers.insert({
        orgId: orgA,
        activityId: act.id,
        token: "tracker-token-a",
      });
    });

    // 2. Create triggers via API
    const resCreateTrigger = await app.request(
      `/api/sequences/${seqAId}/triggers`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenTenantA}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          scoreThreshold: 10,
          actionType: "change_lead_status",
          actionConfig: {
            status: "Qualified",
          },
        }),
      },
    );
    expect(resCreateTrigger.status).toBe(201);
    const triggerData = await resCreateTrigger.json();
    expect(triggerData.success).toBe(true);
    const triggerId = triggerData.data.id;
    expect(triggerId).toBeDefined();

    // Create exit trigger via API
    const resCreateExit = await app.request(
      `/api/sequences/${seqAId}/triggers`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenTenantA}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          scoreThreshold: 15,
          actionType: "auto_exit",
          actionConfig: {},
        }),
      },
    );
    expect(resCreateExit.status).toBe(201);

    // Create task notification trigger via API
    const resCreateTask = await app.request(
      `/api/sequences/${seqAId}/triggers`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenTenantA}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          scoreThreshold: 5,
          actionType: "notify_owner",
          actionConfig: {
            subject: "Urgent: High Engagement Lead",
            body: "Follow up immediately. Lead is highly engaged.",
          },
        }),
      },
    );
    expect(resCreateTask.status).toBe(201);

    // 3. Verify GET triggers lists them correctly
    const resGetTriggers = await app.request(
      `/api/sequences/${seqAId}/triggers`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${tokenTenantA}`,
        },
      },
    );
    expect(resGetTriggers.status).toBe(200);
    const getTriggersData = await resGetTriggers.json();
    expect(getTriggersData.success).toBe(true);
    expect(getTriggersData.data).toHaveLength(3);

    // 4. Assert Tenant RLS boundary
    // Tenant B cannot retrieve Tenant A's sequence triggers
    const resForbiddenGet = await app.request(
      `/api/sequences/${seqAId}/triggers`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${tokenTenantB}`,
        },
      },
    );
    expect(resForbiddenGet.status).toBe(404);

    // Tenant B cannot create triggers on Tenant A's sequence
    const resForbiddenCreate = await app.request(
      `/api/sequences/${seqAId}/triggers`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenTenantB}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          scoreThreshold: 5,
          actionType: "auto_exit",
          actionConfig: {},
        }),
      },
    );
    expect(resForbiddenCreate.status).toBe(404);

    // 5. Test real-time score recalculation and triggers execution
    // Track open event (+1 point)
    const resOpen = await app.request(
      "/api/public/emails/track/open/tracker-token-a",
      {
        method: "GET",
      },
    );
    expect(resOpen.status).toBe(200);

    // Track 3 click events (+3 points each = +9 points, total score = 10)
    for (let i = 0; i < 3; i++) {
      const resClickTemp = await app.request(
        "/api/public/emails/track/click/tracker-token-a?target=https://google.com",
        {
          method: "GET",
        },
      );
      expect(resClickTemp.status).toBe(302);
    }

    // Verify lead status updated to Qualified (threshold 10 was met since score = 10)
    await withTenant(orgA, mockDb, async () => {
      const lead = await dbStore.leads.findOne(leadAId);
      expect(lead?.status).toBe("Qualified");

      // Verify task created for notify_owner (threshold 5 met)
      const tasks = await dbStore.activities.findMany();
      const followUpTask = tasks.find(
        (t) => t.subject === "Urgent: High Engagement Lead",
      );
      expect(followUpTask).toBeDefined();
      expect(followUpTask?.creatorId).toBe("system");

      // Verify activityLink created
      const links = await dbStore.activityLinks.findMany();
      const taskLink = links.find((l) => l.activityId === followUpTask?.id);
      expect(taskLink).toBeDefined();
      expect(taskLink?.targetType).toBe("Lead");
      expect(taskLink?.targetId).toBe(leadAId);

      // Membership status should still be active because score is 10 (auto_exit is threshold 15)
      const membership =
        await dbStore.marketingSequenceMemberships.findOne(membershipAId);
      expect(membership?.status).toBe("active");
      expect(membership?.engagementScore).toBe(10);
    });

    // Now let's track a click event (+3 points). Total score becomes 10 + 3 = 13 (still < 15).
    const resClick = await app.request(
      "/api/public/emails/track/click/tracker-token-a?target=https://google.com",
      {
        method: "GET",
      },
    );
    expect(resClick.status).toBe(302);

    await withTenant(orgA, mockDb, async () => {
      const membership =
        await dbStore.marketingSequenceMemberships.findOne(membershipAId);
      expect(membership?.status).toBe("active");
      expect(membership?.engagementScore).toBe(13);
    });

    // Now let's track another click event (+3 points). Total score becomes 13 + 3 = 16 (>= 15).
    // This should trigger the auto_exit.
    const resClick2 = await app.request(
      "/api/public/emails/track/click/tracker-token-a?target=https://google.com",
      {
        method: "GET",
      },
    );
    expect(resClick2.status).toBe(302);

    // Verify membership auto-completed due to auto_exit trigger
    await withTenant(orgA, mockDb, async () => {
      const membership =
        await dbStore.marketingSequenceMemberships.findOne(membershipAId);
      expect(membership?.status).toBe("completed");
      expect(membership?.engagementScore).toBe(16);
    });

    // 6. Test delete trigger API and isolation
    // Tenant B cannot delete Tenant A's trigger
    const resForbiddenDelete = await app.request(
      `/api/sequences/triggers/${triggerId}`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${tokenTenantB}`,
        },
      },
    );
    expect(resForbiddenDelete.status).toBe(404);

    // Tenant A successfully deletes their trigger
    const resDelete = await app.request(
      `/api/sequences/triggers/${triggerId}`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${tokenTenantA}`,
        },
      },
    );
    expect(resDelete.status).toBe(200);

    const resGetTriggersFinal = await app.request(
      `/api/sequences/${seqAId}/triggers`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${tokenTenantA}`,
        },
      },
    );
    const getTriggersFinalData = await resGetTriggersFinal.json();
    expect(getTriggersFinalData.data).toHaveLength(2); // triggerId is removed
  });
});
