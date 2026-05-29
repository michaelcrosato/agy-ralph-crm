import { createSessionToken } from "@crm/auth";
import { dbStore, mockDb, withTenant } from "@crm/db";
import { beforeEach, describe, expect, it } from "vitest";
import app from "../../../apps/api/src/index";

describe("Marketing Sequence Recipient Engagement Scoring Engine Tests (Task 0208)", () => {
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

  it("should calculate composite engagement scores accurately, trigger real-time recalculations via public tracking endpoints, and enforce strict active tenant RLS boundaries", async () => {
    let seq1Id = "";
    let lead1Id = "";
    let membership1Id = "";

    // 1. Setup Tenant A Data
    await withTenant(orgA, mockDb, async () => {
      // Create Sequence
      const seq1 = await dbStore.marketingSequences.insert({
        orgId: orgA,
        name: "Enterprise Engagement Nurture",
        description: "Testing engagement scoring",
        status: "active",
      });
      seq1Id = seq1.id;

      // Create Lead
      const lead1 = await dbStore.leads.insert({
        orgId: orgA,
        ownerId: "user-a",
        status: "New",
        email: "scoring_lead@example.com",
        company: "Omega Corp",
        convertedAccountId: null,
        convertedContactId: null,
        custom: null,
      });
      lead1Id = lead1.id;

      // Membership
      const membership = await dbStore.marketingSequenceMemberships.insert({
        orgId: orgA,
        sequenceId: seq1.id,
        recordType: "lead",
        recordId: lead1.id,
        status: "active",
        currentStepNumber: 1,
      });
      membership1Id = membership.id;

      // Email activities
      const act1 = await dbStore.activities.insert({
        orgId: orgA,
        creatorId: "user-a",
        type: "email",
        subject: "Introduction to Omega",
        body: "Welcome aboard!",
        dueDate: null,
      });

      // Link activities to leads
      await dbStore.activityLinks.insert({
        orgId: orgA,
        activityId: act1.id,
        targetType: "Lead",
        targetId: lead1.id,
      });

      // Trackers
      await dbStore.emailTrackers.insert({
        orgId: orgA,
        activityId: act1.id,
        token: "scoring-token-1",
      });
    });

    // 2. Query initial engagement scores (should be 0)
    const resInitial = await app.request(
      `/api/sequences/${seq1Id}/engagement-scores`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${tokenTenantA}`,
        },
      },
    );
    expect(resInitial.status).toBe(200);
    const initialData = await resInitial.json();
    expect(initialData.success).toBe(true);
    expect(initialData.data).toHaveLength(1);
    expect(initialData.data[0].engagementScore).toBe(0);
    expect(initialData.data[0].recordName).toBe("Omega Corp");

    // 3. Track email open (+1 point)
    const resOpen = await app.request(
      "/api/public/emails/track/open/scoring-token-1",
      {
        method: "GET",
      },
    );
    expect(resOpen.status).toBe(200);

    // Verify dynamic recalculation on open
    await withTenant(orgA, mockDb, async () => {
      const updated =
        await dbStore.marketingSequenceMemberships.findOne(membership1Id);
      expect(updated?.engagementScore).toBe(1);
    });

    // 4. Track email click (+3 points)
    const resClick = await app.request(
      "/api/public/emails/track/click/scoring-token-1?target=https://google.com",
      {
        method: "GET",
      },
    );
    expect(resClick.status).toBe(302);

    // Verify dynamic recalculation on click (1 open + 1 click = 1 + 3 = 4 points)
    await withTenant(orgA, mockDb, async () => {
      const updated =
        await dbStore.marketingSequenceMemberships.findOne(membership1Id);
      expect(updated?.engagementScore).toBe(4);
    });

    // 5. Track read-time event (Skimmed: 4500ms = +2 points)
    const resReadTime = await app.request(
      "/api/public/emails/track/read-time/scoring-token-1",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          durationMs: 4500,
        }),
      },
    );
    expect(resReadTime.status).toBe(200);

    // Verify score is updated: 4 + 2 = 6 points
    await withTenant(orgA, mockDb, async () => {
      const updated =
        await dbStore.marketingSequenceMemberships.findOne(membership1Id);
      expect(updated?.engagementScore).toBe(6);
    });

    // 6. Recalculate score via protected endpoint
    const resRecalc = await app.request(
      `/api/sequences/members/${membership1Id}/recalculate-score`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenTenantA}`,
        },
      },
    );
    expect(resRecalc.status).toBe(200);
    const recalcData = await resRecalc.json();
    expect(recalcData.success).toBe(true);
    expect(recalcData.engagementScore).toBe(6);

    // 7. Assert active tenant RLS isolation boundaries
    // Tenant B cannot fetch Tenant A's engagement scores
    const resForbiddenScores = await app.request(
      `/api/sequences/${seq1Id}/engagement-scores`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${tokenTenantB}`,
        },
      },
    );
    expect(resForbiddenScores.status).toBe(404);

    // Tenant B cannot trigger score recalculation for Tenant A's member
    const resForbiddenRecalc = await app.request(
      `/api/sequences/members/${membership1Id}/recalculate-score`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenTenantB}`,
        },
      },
    );
    expect(resForbiddenRecalc.status).toBe(404);
  });
});
