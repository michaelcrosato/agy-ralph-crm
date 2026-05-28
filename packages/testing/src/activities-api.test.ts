import { createSessionToken } from "@crm/auth";
import { dbStore, mockDb, withTenant } from "@crm/db";
import { beforeEach, describe, expect, it } from "vitest";
import app from "../../../apps/api/src/index";

describe("Activities & Chronological Timelines REST API Tests", () => {
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

  it("should successfully record activities, link to objects, and return chronological timelines isolated by RLS", async () => {
    // 1. Create a mock Account for Tenant A
    let accountIdA = "";
    await withTenant(orgA, mockDb, async () => {
      const acc = await dbStore.accounts.insert({
        orgId: orgA,
        ownerId: "user-a",
        name: "Acme Corp",
        domain: "acme.com",
        custom: null,
      });
      accountIdA = acc.id;
    });

    // 2. Tenant A records a Call activity linked to the Account
    const callRes = await app.request("/api/activities", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenTenantA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        type: "call",
        subject: "Initial Discovery Call",
        body: "Talked about pricing and timeline requirements.",
        dueDate: new Date(Date.now() + 86400000).toISOString(),
        links: [{ targetType: "Account", targetId: accountIdA }],
      }),
    });

    expect(callRes.status).toBe(200);
    const callBody = await callRes.json();
    expect(callBody.success).toBe(true);
    expect(callBody.data.id).toBeDefined();
    expect(callBody.data.subject).toBe("Initial Discovery Call");
    expect(callBody.data.links.length).toBe(1);
    expect(callBody.data.links[0].targetId).toBe(accountIdA);

    const callId = callBody.data.id;

    // Small delay to ensure timestamp separation
    await new Promise((resolve) => setTimeout(resolve, 10));

    // 3. Tenant A records a Note activity linked to the Account
    const noteRes = await app.request("/api/activities", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenTenantA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        type: "note",
        subject: "Acme R&D Requirements Sheet",
        body: "Attached file with technical specifications.",
        links: [{ targetType: "Account", targetId: accountIdA }],
      }),
    });

    expect(noteRes.status).toBe(200);
    const noteBody = await noteRes.json();
    expect(noteBody.success).toBe(true);
    const noteId = noteBody.data.id;

    // 4. Retrieve single activity for Tenant A -> returns correct details
    const getResA = await app.request(`/api/activities/${callId}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${tokenTenantA}`,
      },
    });
    expect(getResA.status).toBe(200);
    const getBodyA = await getResA.json();
    expect(getBodyA.success).toBe(true);
    expect(getBodyA.data.subject).toBe("Initial Discovery Call");

    // 5. Retrieve single activity for Tenant B -> returns 404
    const getResB = await app.request(`/api/activities/${callId}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${tokenTenantB}`,
      },
    });
    expect(getResB.status).toBe(404);

    // 6. Retrieve timeline for Tenant A -> returns in reverse chronological order (newest first: Note first, then Call)
    const timelineResA = await app.request(
      `/api/activities/timeline/Account/${accountIdA}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${tokenTenantA}`,
        },
      },
    );
    expect(timelineResA.status).toBe(200);
    const timelineBodyA = await timelineResA.json();
    expect(timelineBodyA.success).toBe(true);
    expect(timelineBodyA.data.length).toBe(2);
    expect(timelineBodyA.data[0].id).toBe(noteId);
    expect(timelineBodyA.data[1].id).toBe(callId);

    // 7. Retrieve timeline for Tenant B -> returns empty list under RLS
    const timelineResB = await app.request(
      `/api/activities/timeline/Account/${accountIdA}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${tokenTenantB}`,
        },
      },
    );
    expect(timelineResB.status).toBe(200);
    const timelineBodyB = await timelineResB.json();
    expect(timelineBodyB.success).toBe(true);
    expect(timelineBodyB.data.length).toBe(0);
  });
});
