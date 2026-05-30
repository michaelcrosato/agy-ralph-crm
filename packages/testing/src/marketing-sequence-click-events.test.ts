import { createSessionToken } from "@crm/auth";
import { dbStore, mockDb, withTenant } from "@crm/db";
import { beforeEach, describe, expect, it } from "vitest";
import { createTestApp } from "./_harness";

const app = createTestApp();

describe("Marketing Sequence Email Granular Click Events & UTM Tracking Tests (Task 0200)", () => {
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

  it("should parse UTM tags, log granular click events with headers, allow retrieval, and enforce strict RLS isolation", async () => {
    let leadIdA = "";
    let activityIdA = "";
    let trackerIdA = "";
    let tokenA = "";

    // 1. Setup Lead and Email Activity for Tenant A
    await withTenant(orgA, mockDb, async () => {
      const lead = await dbStore.leads.insert({
        orgId: orgA,
        ownerId: "user-a",
        status: "New",
        email: "lead@example.com",
        company: "Example Corp",
        convertedAccountId: null,
        convertedContactId: null,
        custom: null,
      });
      leadIdA = lead.id;

      const act = await dbStore.activities.insert({
        orgId: orgA,
        creatorId: "user-a",
        type: "email",
        subject: "Marketing Blast Q1",
        body: "Check out our site!",
        dueDate: null,
      });
      activityIdA = act.id;

      await dbStore.activityLinks.insert({
        orgId: orgA,
        activityId: activityIdA,
        targetType: "Lead",
        targetId: leadIdA,
      });
    });

    // 2. Generate email tracker token for the activity
    const createRes = await app.request(`/api/emails/${activityIdA}/tracker`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenTenantA}`,
      },
    });
    expect(createRes.status).toBe(200);
    const createBody = await createRes.json();
    trackerIdA = createBody.tracker.id;
    tokenA = createBody.tracker.token;

    // 3. Perform a simulated public click request with custom IP, UA headers, and detailed UTM parameters
    const testUrl =
      "https://example.com/pricing?utm_source=newsletter&utm_medium=email&utm_campaign=spring_sale&utm_term=saas&utm_content=pricing_btn";
    const trackClickRes = await app.request(
      `/api/public/emails/track/click/${tokenA}?target=${encodeURIComponent(testUrl)}`,
      {
        method: "GET",
        headers: {
          "X-Forwarded-For": "203.0.113.195",
          "User-Agent":
            "Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15",
        },
      },
    );

    // Assert redirect behavior
    expect(trackClickRes.status).toBe(302);
    expect(trackClickRes.headers.get("location")).toBe(testUrl);

    // 4. Verify granular click event was logged in the DB under Tenant A
    await withTenant(orgA, mockDb, async () => {
      const tracker = await dbStore.emailTrackers.findOne(trackerIdA);
      expect(tracker).not.toBeNull();
      expect(tracker?.clickCount).toBe(1);

      const clicks = await dbStore.emailClickEvents.findForTracker(trackerIdA);
      expect(clicks.length).toBe(1);

      const clickEvent = clicks[0];
      expect(clickEvent.trackerId).toBe(trackerIdA);
      expect(clickEvent.clickedUrl).toBe(testUrl);
      expect(clickEvent.ipAddress).toBe("203.0.113.195");
      expect(clickEvent.userAgent).toBe(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15",
      );
      expect(clickEvent.utmSource).toBe("newsletter");
      expect(clickEvent.utmMedium).toBe("email");
      expect(clickEvent.utmCampaign).toBe("spring_sale");
      expect(clickEvent.utmTerm).toBe("saas");
      expect(clickEvent.utmContent).toBe("pricing_btn");
    });

    // 5. Query the retrieval API with Tenant A token (authorized)
    const getClicksRes = await app.request(
      `/api/emails/trackers/${trackerIdA}/clicks`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${tokenTenantA}`,
        },
      },
    );
    expect(getClicksRes.status).toBe(200);
    const getClicksBody = await getClicksRes.json();
    expect(getClicksBody.success).toBe(true);
    expect(getClicksBody.clicks.length).toBe(1);
    expect(getClicksBody.clicks[0].clickedUrl).toBe(testUrl);

    // 6. Query the retrieval API with Tenant B token (unauthorized - RLS Tenant Boundary check)
    const crossTenantRes = await app.request(
      `/api/emails/trackers/${trackerIdA}/clicks`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${tokenTenantB}`,
        },
      },
    );
    expect(crossTenantRes.status).toBe(404); // Should return 404 or 403 for unauthorized/isolation
  });
});
