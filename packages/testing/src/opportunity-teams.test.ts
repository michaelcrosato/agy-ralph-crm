import { createSessionToken } from "@crm/auth";
import { dbStore, mockDb, store, withTenant } from "@crm/db";
import { beforeEach, describe, expect, it, vi } from "vitest";
import app from "../../../apps/api/src/index";

describe("Opportunity Teams & Collaborative Roles API & RLS Integration Tests", () => {
  let tokenTenantA: string;
  let tokenTenantB: string;

  const orgA = "org-tenant-a";
  const orgB = "org-tenant-b";

  let opportunityAId: string;
  let opportunityBId: string;

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

    // Seed Opportunities under separate tenants
    await withTenant(orgA, mockDb, async () => {
      const acc = await dbStore.accounts.insert({
        orgId: orgA,
        ownerId: "user-a",
        name: "Acme Corp (Tenant A)",
        domain: "acme.com",
        custom: null,
      });
      const opp = await dbStore.opportunities.insert({
        orgId: orgA,
        ownerId: "user-a",
        accountId: acc.id,
        name: "Pipeline Deal A",
        stage: "Prospecting",
        amount: "10000.00",
        closeDate: new Date(),
        custom: null,
      });
      opportunityAId = opp.id;
    });

    await withTenant(orgB, mockDb, async () => {
      const acc = await dbStore.accounts.insert({
        orgId: orgB,
        ownerId: "user-b",
        name: "BuyMore (Tenant B)",
        domain: "buymore.com",
        custom: null,
      });
      const opp = await dbStore.opportunities.insert({
        orgId: orgB,
        ownerId: "user-b",
        accountId: acc.id,
        name: "Pipeline Deal B",
        stage: "Prospecting",
        amount: "20000.00",
        closeDate: new Date(),
        custom: null,
      });
      opportunityBId = opp.id;
    });
  });

  it("should successfully add, update, retrieve, and delete an opportunity team member", async () => {
    const testUserId = "00000000-0000-0000-0000-000000000001";

    // 1. Add team member to Opportunity A
    const addRes = await app.request(
      `/api/opportunities/${opportunityAId}/team`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenTenantA}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: testUserId,
          role: "Sales Engineer",
        }),
      },
    );
    expect(addRes.status).toBe(201);
    const addBody = await addRes.json();
    expect(addBody.success).toBe(true);
    expect(addBody.data.role).toBe("Sales Engineer");
    expect(addBody.data.userId).toBe(testUserId);

    // 2. Fetch the team members of Opportunity A
    const getRes = await app.request(
      `/api/opportunities/${opportunityAId}/team`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${tokenTenantA}`,
        },
      },
    );
    expect(getRes.status).toBe(200);
    const getBody = await getRes.json();
    expect(getBody.success).toBe(true);
    expect(getBody.data.length).toBe(1);
    expect(getBody.data[0].role).toBe("Sales Engineer");

    // 3. Update the team member's role
    const updateRes = await app.request(
      `/api/opportunities/${opportunityAId}/team`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenTenantA}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: testUserId,
          role: "Executive Sponsor",
        }),
      },
    );
    expect(updateRes.status).toBe(200);
    const updateBody = await updateRes.json();
    expect(updateBody.success).toBe(true);
    expect(updateBody.data.role).toBe("Executive Sponsor");

    // 4. Verify in the audit log that the action was recorded
    await withTenant(orgA, mockDb, async () => {
      const logs = await dbStore.auditLogs.findMany();
      const teamLogs = logs.filter(
        (l) =>
          l.recordId === opportunityAId &&
          l.recordType === "opportunities" &&
          (l.action === "opportunity_team_member_added" ||
            l.action === "opportunity_team_member_updated"),
      );
      expect(teamLogs.length).toBe(2);
    });

    // 5. Remove team member
    const deleteRes = await app.request(
      `/api/opportunities/${opportunityAId}/team/${testUserId}`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${tokenTenantA}`,
        },
      },
    );
    expect(deleteRes.status).toBe(200);

    // 6. Fetch team members again, verify empty
    const getRes2 = await app.request(
      `/api/opportunities/${opportunityAId}/team`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${tokenTenantA}`,
        },
      },
    );
    const getBody2 = await getRes2.json();
    expect(getBody2.data.length).toBe(0);
  });

  it("should enforce RLS boundaries and block cross-tenant team access", async () => {
    const testUserId = "00000000-0000-0000-0000-000000000002";

    // Tenant B attempts to add a team member to Tenant A's opportunity
    const addRes = await app.request(
      `/api/opportunities/${opportunityAId}/team`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenTenantB}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: testUserId,
          role: "Sales Engineer",
        }),
      },
    );
    expect(addRes.status).toBe(404); // Opportunity not found due to tenant isolation

    // Tenant B attempts to fetch team members of Tenant A's opportunity
    const getRes = await app.request(
      `/api/opportunities/${opportunityAId}/team`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${tokenTenantB}`,
        },
      },
    );
    expect(getRes.status).toBe(404); // Opportunity not found due to tenant isolation

    // Tenant B attempts to delete a team member of Tenant A's opportunity
    const deleteRes = await app.request(
      `/api/opportunities/${opportunityAId}/team/${testUserId}`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${tokenTenantB}`,
        },
      },
    );
    expect(deleteRes.status).toBe(404); // Opportunity not found due to tenant isolation
  });

  it("should return bad request for unsupported roles and malformed IDs", async () => {
    const addRes = await app.request(
      `/api/opportunities/${opportunityAId}/team`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenTenantA}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: "invalid-uuid",
          role: "Sales Representative",
        }),
      },
    );
    expect(addRes.status).toBe(400);

    const addRes2 = await app.request(
      `/api/opportunities/${opportunityAId}/team`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenTenantA}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: "00000000-0000-0000-0000-000000000003",
          role: "CEO", // Unsupported role
        }),
      },
    );
    expect(addRes2.status).toBe(400);
  });
});
