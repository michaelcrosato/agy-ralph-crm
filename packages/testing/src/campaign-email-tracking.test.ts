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
});
