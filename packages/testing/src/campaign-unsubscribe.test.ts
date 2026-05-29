import { createSessionToken } from "@crm/auth";
import { dbStore, mockDb, withTenant } from "@crm/db";
import { beforeEach, describe, expect, it } from "vitest";
import app from "../../../apps/api/src/index";

describe("Campaign Unsubscribe & Recipient Opt-Out API Tests", () => {
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

  it("should successfully unsubscribe recipient via public route, update consent, and record audit trail under RLS isolation", async () => {
    let leadIdA = "";
    let contactIdA = "";
    let activityIdA = "";

    // 1. Setup Lead, Contact, and Email Activity for Tenant A
    await withTenant(orgA, mockDb, async () => {
      const lead = await dbStore.leads.insert({
        orgId: orgA,
        ownerId: "user-a",
        status: "New",
        email: "lead@acme.com",
        company: "Acme Lead Corp",
        convertedAccountId: null,
        convertedContactId: null,
        custom: null,
      });
      leadIdA = lead.id;

      const contact = await dbStore.contacts.insert({
        orgId: orgA,
        ownerId: "user-a",
        accountId: null,
        firstName: "Jane",
        lastName: "Doe",
        email: "jane.doe@acme.com",
        custom: null,
      });
      contactIdA = contact.id;

      const act = await dbStore.activities.insert({
        orgId: orgA,
        creatorId: "user-a",
        type: "email",
        subject: "Q3 Campaign Blast",
        body: "Check out our latest products!",
        dueDate: null,
      });
      activityIdA = act.id;

      // Link email activity to both the Lead and Contact
      await dbStore.activityLinks.insert({
        orgId: orgA,
        activityId: activityIdA,
        targetType: "Lead",
        targetId: leadIdA,
      });

      await dbStore.activityLinks.insert({
        orgId: orgA,
        activityId: activityIdA,
        targetType: "Contact",
        targetId: contactIdA,
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
    const token = createBody.tracker.token;

    // 3. Call public unsubscribe using the token (no authorization header)
    const unsubscribeRes = await app.request(
      `/api/public/emails/unsubscribe/${token}`,
      {
        method: "GET",
      },
    );

    expect(unsubscribeRes.status).toBe(200);
    expect(unsubscribeRes.headers.get("Content-Type")).toBe("text/html");
    const htmlResponse = await unsubscribeRes.text();
    expect(htmlResponse).toContain("Successfully Unsubscribed");
    expect(htmlResponse).toContain("Your email address has been opted out");

    // 4. Verify that Tenant A's Lead and Contact have consent updated to opt_out
    await withTenant(orgA, mockDb, async () => {
      const allPrefs = await dbStore.contactConsentPreferences.findMany();
      expect(allPrefs.length).toBe(2);

      const leadPref = allPrefs.find(
        (p) => p.recordType === "lead" && p.recordId === leadIdA,
      );
      expect(leadPref).toBeDefined();
      expect(leadPref?.status).toBe("opt_out");
      expect(leadPref?.channel).toBe("email");
      expect(leadPref?.source).toBe("public_unsubscribe");

      const contactPref = allPrefs.find(
        (p) => p.recordType === "contact" && p.recordId === contactIdA,
      );
      expect(contactPref).toBeDefined();
      expect(contactPref?.status).toBe("opt_out");
      expect(contactPref?.channel).toBe("email");
      expect(contactPref?.source).toBe("public_unsubscribe");

      // Verify that audit logs were generated correctly for the consent upserts
      const auditLogs = await dbStore.auditLogs.findMany();
      const consentLogs = auditLogs.filter(
        (log) => log.recordType === "contact_consent_preferences",
      );
      expect(consentLogs.length).toBe(2);
      expect(consentLogs[0].action).toBe("upsert");
      expect(consentLogs[0].userId).toBe(
        "00000000-0000-0000-0000-000000000000",
      );
    });

    // 5. Verify RLS Isolation: Tenant B cannot query Tenant A's newly registered consent preferences
    const queryConsentBRes = await app.request(
      `/api/consent?recordType=lead&recordId=${leadIdA}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${tokenTenantB}`,
        },
      },
    );
    expect(queryConsentBRes.status).toBe(404); // Returns 404 (due to RLS checking ownership of leadIdA)
  });

  it("should return 404 when unsubscribe is called with an invalid token", async () => {
    const res = await app.request(
      "/api/public/emails/unsubscribe/invalid-token-xyz",
      {
        method: "GET",
      },
    );
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error).toBe("Invalid tracking token");
  });
});
