import { createSessionToken } from "@crm/auth";
import { dbStore, mockDb, withTenant } from "@crm/db";
import { beforeEach, describe, expect, it } from "vitest";
import app from "../../../apps/api/src/index";

describe("Marketing Sequence Email Unsubscribe Reasons Tests (Task 0201)", () => {
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

  it("should log unsubscribe reasons, allow retrieval, and enforce strict tenant RLS isolation", async () => {
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

    // 3. Post a simulated public unsubscribe reason request
    const unsubscribeReasonRes = await app.request(
      `/api/public/emails/unsubscribe/${tokenA}/reason`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          reason: "frequency",
          feedback: "Too many emails in one week!",
        }),
      },
    );

    expect(unsubscribeReasonRes.status).toBe(200);
    const unsubBody = await unsubscribeReasonRes.json();
    expect(unsubBody.success).toBe(true);
    expect(unsubBody.data.id).toBeDefined();
    expect(unsubBody.data.reason).toBe("frequency");
    expect(unsubBody.data.feedback).toBe("Too many emails in one week!");

    // 4. Verify in DB that unsubscribe reason is saved for Tenant A
    await withTenant(orgA, mockDb, async () => {
      const unsubs = await dbStore.emailUnsubscribes.findMany();
      expect(unsubs.length).toBe(1);
      expect(unsubs[0].trackerId).toBe(trackerIdA);
      expect(unsubs[0].reason).toBe("frequency");
      expect(unsubs[0].feedback).toBe("Too many emails in one week!");

      // Verify audit log entry was created
      const logs = await dbStore.auditLogs.findMany();
      const unsubLog = logs.find(
        (l) => l.action === "unsubscribe_reason" && l.recordId === activityIdA,
      );
      expect(unsubLog).toBeDefined();
      expect(unsubLog?.changes?.reason?.after).toBe("frequency");
    });

    // 5. Query the retrieval API with Tenant A token (authorized)
    const getUnsubsRes = await app.request("/api/unsubscribes", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${tokenTenantA}`,
      },
    });
    expect(getUnsubsRes.status).toBe(200);
    const getUnsubsBody = await getUnsubsRes.json();
    expect(getUnsubsBody.success).toBe(true);
    expect(getUnsubsBody.data.length).toBe(1);
    expect(getUnsubsBody.data[0].reason).toBe("frequency");
    expect(getUnsubsBody.data[0].feedback).toBe("Too many emails in one week!");

    // 6. Query the retrieval API with Tenant B token (authorized for Tenant B, but should NOT see Tenant A's unsubscribes)
    const crossTenantRes = await app.request("/api/unsubscribes", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${tokenTenantB}`,
      },
    });

    expect(crossTenantRes.status).toBe(200);
    const crossTenantBody = await crossTenantRes.json();
    expect(crossTenantBody.success).toBe(true);
    expect(crossTenantBody.data.length).toBe(0); // Strict Tenant RLS isolation!
  });

  it("should reject invalid unsubscribe reason parameters", async () => {
    // Attempt with invalid reason value
    const resInvalidReason = await app.request(
      "/api/public/emails/unsubscribe/invalid-token/reason",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          reason: "not_a_valid_reason_code",
          feedback: "Spam",
        }),
      },
    );
    expect(resInvalidReason.status).toBe(400);

    // Attempt with missing reason parameter
    const resMissingReason = await app.request(
      "/api/public/emails/unsubscribe/invalid-token/reason",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          feedback: "Spam",
        }),
      },
    );
    expect(resMissingReason.status).toBe(400);
  });
});
