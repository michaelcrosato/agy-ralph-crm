import { createSessionToken } from "@crm/auth";
import { dbStore, mockDb, withTenant } from "@crm/db";
import { beforeEach, describe, expect, it } from "vitest";
import { createTestApp } from "./_harness";

const app = createTestApp();

describe("Marketing Segments & Dynamic Lists API Tests", () => {
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

  it("should support segment CRUD, resolve members dynamically, support custom fields, and enforce tenant RLS boundaries", async () => {
    let lead1Id = "";
    let lead2Id = "";
    let lead3Id = "";
    let segmentId = "";

    // 1. Setup mock Leads for Tenant A
    await withTenant(orgA, mockDb, async () => {
      // Lead 1: Matches name filter (New status) and company filter (Acme)
      const l1 = await dbStore.leads.insert({
        orgId: orgA,
        ownerId: "user-a",
        status: "New",
        email: "alice@acme.com",
        company: "Acme Corporation",
        convertedAccountId: null,
        convertedContactId: null,
        custom: { tier: "gold" },
      });
      lead1Id = l1.id;

      // Lead 2: Matches status but not company
      const l2 = await dbStore.leads.insert({
        orgId: orgA,
        ownerId: "user-a",
        status: "New",
        email: "bob@beta.com",
        company: "Beta Industries",
        convertedAccountId: null,
        convertedContactId: null,
        custom: { tier: "silver" },
      });
      lead2Id = l2.id;

      // Lead 3: Matches company but not status
      const l3 = await dbStore.leads.insert({
        orgId: orgA,
        ownerId: "user-a",
        status: "Working",
        email: "charlie@acme.com",
        company: "Acme Labs",
        convertedAccountId: null,
        convertedContactId: null,
        custom: { tier: "gold" },
      });
      lead3Id = l3.id;
    });

    // 2. Setup a Lead for Tenant B to verify RLS leak prevention
    await withTenant(orgB, mockDb, async () => {
      await dbStore.leads.insert({
        orgId: orgB,
        ownerId: "user-b",
        status: "New",
        email: "other@acme.com",
        company: "Acme Corporation",
        convertedAccountId: null,
        convertedContactId: null,
        custom: { tier: "gold" },
      });
    });

    // 3. Create a Segment for Tenant A via REST API
    // Dynamic Filter: status equals "New" AND company contains "Acme"
    const createRes = await app.request("/api/segments", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenTenantA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "New Acme Leads",
        description: "US-based New Acme Leads",
        objectType: "lead",
        criteria: [
          { field: "status", operator: "equals", value: "New" },
          { field: "company", operator: "contains", value: "Acme" },
        ],
      }),
    });
    expect(createRes.status).toBe(200);
    const createBody = await createRes.json();
    expect(createBody.success).toBe(true);
    segmentId = createBody.segment.id;
    expect(segmentId).toBeDefined();

    // 4. Retrieve segment details
    const getRes = await app.request(`/api/segments/${segmentId}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${tokenTenantA}`,
      },
    });
    expect(getRes.status).toBe(200);
    const getBody = await getRes.json();
    expect(getBody.segment.name).toBe("New Acme Leads");

    // 5. Dynamically resolve segment members for Tenant A
    const resolveRes = await app.request(`/api/segments/${segmentId}/members`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${tokenTenantA}`,
      },
    });
    expect(resolveRes.status).toBe(200);
    const resolveBody = await resolveRes.json();
    expect(resolveBody.success).toBe(true);

    // Dynamic Resolution Check: Only lead1 (New, Acme Corporation) should match!
    const memberIds = resolveBody.data.map((m: { id: string }) => m.id);
    expect(memberIds.length).toBe(1);
    expect(memberIds).toContain(lead1Id);
    expect(memberIds).not.toContain(lead2Id);
    expect(memberIds).not.toContain(lead3Id);

    // 6. Test custom fields evaluation in criteria
    const customSegRes = await app.request("/api/segments", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenTenantA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "Gold Status Segment",
        objectType: "lead",
        criteria: [{ field: "custom.tier", operator: "equals", value: "gold" }],
      }),
    });
    expect(customSegRes.status).toBe(200);
    const customSegBody = await customSegRes.json();
    const goldSegId = customSegBody.segment.id;

    const resolveGoldRes = await app.request(
      `/api/segments/${goldSegId}/members`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${tokenTenantA}`,
        },
      },
    );
    expect(resolveGoldRes.status).toBe(200);
    const resolveGoldBody = await resolveGoldRes.json();
    const goldMemberIds = resolveGoldBody.data.map((m: { id: string }) => m.id);
    // Dynamic Resolution Check: lead1 (gold) and lead3 (gold) should match
    expect(goldMemberIds.length).toBe(2);
    expect(goldMemberIds).toContain(lead1Id);
    expect(goldMemberIds).toContain(lead3Id);
    expect(goldMemberIds).not.toContain(lead2Id);

    // 7. Verify RLS tenant isolation: Tenant B cannot list Tenant A's segments
    const listResB = await app.request("/api/segments", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${tokenTenantB}`,
      },
    });
    expect(listResB.status).toBe(200);
    const listBodyB = await listResB.json();
    expect(listBodyB.data.length).toBe(0); // Tenant B sees no segments

    // 8. Verify RLS tenant isolation: Tenant B cannot retrieve Tenant A's segment details
    const getResB = await app.request(`/api/segments/${segmentId}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${tokenTenantB}`,
      },
    });
    expect(getResB.status).toBe(404); // Segment not found (RLS blocks access)

    // 9. Verify RLS tenant isolation: Tenant B cannot resolve Tenant A's segment members
    const resolveResB = await app.request(
      `/api/segments/${segmentId}/members`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${tokenTenantB}`,
        },
      },
    );
    expect(resolveResB.status).toBe(404); // RLS blocks resolution

    // 10. Delete the segment
    const deleteRes = await app.request(`/api/segments/${segmentId}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${tokenTenantA}`,
      },
    });
    expect(deleteRes.status).toBe(200);

    // Verify it is gone
    const checkRes = await app.request(`/api/segments/${segmentId}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${tokenTenantA}`,
      },
    });
    expect(checkRes.status).toBe(404);
  });
});
