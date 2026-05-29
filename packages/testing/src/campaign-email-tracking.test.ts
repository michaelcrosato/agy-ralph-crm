import { createSessionToken } from "@crm/auth";
import { dbStore, mockDb, withTenant } from "@crm/db";
import { beforeEach, describe, expect, it } from "vitest";
import app from "../../../apps/api/src/index";

describe("Outbound Email Open & Click Tracking API", () => {
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

  it("should successfully create tracker, track open/click events publicly, and enforce tenant isolation", async () => {
    // 1. Create a mock email activity for Tenant A
    let activityIdA = "";
    await withTenant(orgA, mockDb, async () => {
      const act = await dbStore.activities.insert({
        orgId: orgA,
        creatorId: "user-a",
        type: "email",
        subject: "Marketing Campaign Launch",
        body: "Check out our new products!",
        dueDate: null,
        custom: {
          from: "marketing@tenant-a.com",
          to: ["lead@external.com"],
          cc: [],
          bcc: [],
        },
      });
      activityIdA = act.id;
    });

    // 2. Request tracking configuration creation for Tenant A
    const createRes = await app.request(`/api/emails/${activityIdA}/tracker`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenTenantA}`,
      },
    });

    expect(createRes.status).toBe(200);
    const createBody = await createRes.json();
    expect(createBody.success).toBe(true);
    expect(createBody.tracker).toBeDefined();
    expect(createBody.tracker.token).toBeDefined();
    expect(createBody.tracker.openCount).toBe(0);
    expect(createBody.tracker.clickCount).toBe(0);

    const token = createBody.tracker.token;

    // 3. Verify Tenant B cannot create tracking configuration for Tenant A's activity
    const createResB = await app.request(`/api/emails/${activityIdA}/tracker`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenTenantB}`,
      },
    });
    expect(createResB.status).toBe(404);

    // 4. Verify public open tracking works (without auth token)
    const openRes = await app.request(
      `/api/public/emails/track/open/${token}`,
      {
        method: "GET",
      },
    );
    expect(openRes.status).toBe(200);
    expect(openRes.headers.get("Content-Type")).toBe("image/gif");
    expect(openRes.headers.get("Cache-Control")).toContain("no-cache");

    // 5. Verify public click tracking works (without auth token) and redirects correctly
    const clickRes = await app.request(
      `/api/public/emails/track/click/${token}?target=https://example.com/promo`,
      {
        method: "GET",
      },
    );
    expect(clickRes.status).toBe(302);
    expect(clickRes.headers.get("Location")).toBe("https://example.com/promo");

    // 6. Verify Tenant A can fetch tracker statistics and they are updated correctly
    const getResA = await app.request(`/api/emails/${activityIdA}/tracker`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${tokenTenantA}`,
      },
    });
    expect(getResA.status).toBe(200);
    const getBodyA = await getResA.json();
    expect(getBodyA.success).toBe(true);
    expect(getBodyA.tracker.openCount).toBe(1);
    expect(getBodyA.tracker.clickCount).toBe(1);
    expect(getBodyA.tracker.lastOpenedAt).not.toBeNull();
    expect(getBodyA.tracker.lastClickedAt).not.toBeNull();

    // 7. Verify Tenant B cannot retrieve Tenant A's tracker statistics (RLS boundaries)
    const getResB = await app.request(`/api/emails/${activityIdA}/tracker`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${tokenTenantB}`,
      },
    });
    expect(getResB.status).toBe(404);
  });

  describe("UTM Campaign Link Engagement Tracking & ROI Webhooks (TASK002)", () => {
    it("should successfully create a campaign with UTM parameters, track engagement, and isolate data", async () => {
      let campaignId = "";
      let leadId = "";

      // 1. Create a campaign with UTM tags for Tenant A
      const createRes = await app.request("/api/campaigns", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenTenantA}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: "Q2 Email blast Promo",
          status: "Active",
          type: "Email",
          utmSource: "newsletter",
          utmMedium: "email",
          utmCampaign: "q2_promo",
        }),
      });

      expect(createRes.status).toBe(200);
      const createBody = await createRes.json();
      expect(createBody.success).toBe(true);
      expect(createBody.data.id).toBeDefined();
      expect(createBody.data.utmSource).toBe("newsletter");
      expect(createBody.data.utmMedium).toBe("email");
      expect(createBody.data.utmCampaign).toBe("q2_promo");
      campaignId = createBody.data.id;

      // Create a Lead in Tenant A context
      await withTenant(orgA, mockDb, async () => {
        const lead = await dbStore.leads.insert({
          orgId: orgA,
          email: "target-lead@promo.com",
          company: "External Corp",
          status: "New",
          ownerId: "user-a",
        });
        leadId = lead.id;
      });

      // 2. Track public UTM click event (unauthenticated client-side webhook call)
      const trackRes = await app.request(
        `/api/public/campaigns/${campaignId}/track-utm`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            utmSource: "newsletter",
            utmMedium: "email",
            utmCampaign: "q2_promo",
            leadId,
          }),
        },
      );

      expect(trackRes.status).toBe(200);
      const trackBody = await trackRes.json();
      expect(trackBody.success).toBe(true);

      // 3. Verify Tenant A can see the task activity and campaign member responses
      await withTenant(orgA, mockDb, async () => {
        // CRM Activity verification
        const activities = await dbStore.activities.findMany();
        const utmAct = activities.find((a) =>
          a.subject.includes("UTM Campaign Link Click"),
        );
        expect(utmAct).toBeDefined();
        expect(utmAct?.body).toContain("Source: newsletter");
        expect(utmAct?.body).toContain("Medium: email");
        expect(utmAct?.body).toContain("Campaign: q2_promo");

        // Campaign member verification
        const members =
          await dbStore.campaignMembers.findForCampaign(campaignId);
        expect(members).toHaveLength(1);
        expect(members[0].leadId).toBe(leadId);
        expect(members[0].status).toBe("Responded");
      });

      // 4. Verify Tenant B cannot access Tenant A's campaign details or stats (RLS checks)
      const getResB = await app.request(`/api/campaigns/${campaignId}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${tokenTenantB}`,
        },
      });
      expect(getResB.status).toBe(404);
    });
  });
});
