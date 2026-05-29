import { createSessionToken } from "@crm/auth";
import { dbStore, mockDb, withTenant } from "@crm/db";
import { beforeEach, describe, expect, it } from "vitest";
import app from "../../../apps/api/src/index";

describe("Outbound Email Log Adapters & Service Activity Integrations", () => {
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

  it("should successfully log emails, link to objects, and return logs isolated by RLS", async () => {
    // 1. Create a mock Contact for Tenant A
    let contactIdA = "";
    await withTenant(orgA, mockDb, async () => {
      const contact = await dbStore.contacts.insert({
        orgId: orgA,
        ownerId: "user-a",
        accountId: null,
        firstName: "John",
        lastName: "Doe",
        email: "john.doe@acme.com",
        custom: null,
      });
      contactIdA = contact.id;
    });

    // 2. Log outbound email linked to the contact
    const logRes = await app.request("/api/emails/log", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenTenantA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "agent@tenant-a.com",
        to: ["john.doe@acme.com"],
        cc: ["manager@tenant-a.com"],
        bcc: [],
        subject: "Contract Agreement",
        body: "Hi John, attached is the contract for signature.",
        links: [{ targetType: "Contact", targetId: contactIdA }],
      }),
    });

    expect(logRes.status).toBe(200);
    const logBody = await logRes.json();
    expect(logBody.success).toBe(true);
    expect(logBody.data.id).toBeDefined();
    expect(logBody.data.subject).toBe("Contract Agreement");
    expect(logBody.data.custom).toBeDefined();
    expect(logBody.data.custom.from).toBe("agent@tenant-a.com");
    expect(logBody.data.custom.to).toEqual(["john.doe@acme.com"]);

    const emailId = logBody.data.id;

    // 3. Retrieve single email log for Tenant A -> returns correct details
    const getResA = await app.request(`/api/emails/${emailId}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${tokenTenantA}`,
      },
    });
    expect(getResA.status).toBe(200);
    const getBodyA = await getResA.json();
    expect(getBodyA.success).toBe(true);
    expect(getBodyA.data.subject).toBe("Contract Agreement");
    expect(getBodyA.data.links.length).toBe(1);
    expect(getBodyA.data.links[0].targetId).toBe(contactIdA);

    // 4. Retrieve single email log for Tenant B -> returns 404 (due to RLS separation)
    const getResB = await app.request(`/api/emails/${emailId}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${tokenTenantB}`,
      },
    });
    expect(getResB.status).toBe(404);
  });

  it("should reject email log request with invalid email format", async () => {
    const logRes = await app.request("/api/emails/log", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenTenantA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "invalid-email-address",
        to: ["john.doe@acme.com"],
        subject: "Contract Agreement",
        body: "Some body text",
        links: [],
      }),
    });

    expect(logRes.status).toBe(400);
    const body = await logRes.json();
    expect(body.error).toContain("Invalid 'from' email format");
  });

  it("should reject email log request with missing subject or body", async () => {
    const logRes = await app.request("/api/emails/log", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenTenantA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "agent@tenant-a.com",
        to: ["john.doe@acme.com"],
        subject: "",
        body: "Some body text",
        links: [],
      }),
    });

    expect(logRes.status).toBe(400);
    const body = await logRes.json();
    expect(body.error).toContain("'subject' is required");
  });
});
