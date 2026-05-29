import { createSessionToken } from "@crm/auth";
import { dbStore, mockDb, store, withTenant } from "@crm/db";
import { beforeEach, describe, expect, it } from "vitest";
import app from "../../../apps/api/src/index";

describe("Contracts & Account Renewals API & Integration Tests", () => {
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

  it("should support complete CRUD lifecycle for contracts under RLS isolation", async () => {
    let accountId = "";

    // 1. Setup Account for Tenant A
    await withTenant(orgA, mockDb, async () => {
      const account = await dbStore.accounts.insert({
        orgId: orgA,
        ownerId: "user-a",
        name: "Acme Corporate Partner",
        domain: "acme.com",
        custom: null,
      });
      accountId = account.id;
    });

    // 2. GET contracts initially (should be empty)
    const resGetEmpty = await app.request(
      `/api/accounts/${accountId}/contracts`,
      {
        method: "GET",
        headers: { Authorization: `Bearer ${tokenTenantA}` },
      },
    );
    expect(resGetEmpty.status).toBe(200);
    const bodyGetEmpty = await resGetEmpty.json();
    expect(bodyGetEmpty.success).toBe(true);
    expect(bodyGetEmpty.data).toHaveLength(0);

    // 3. POST contract (Draft status)
    const startDate = new Date();
    const endDate = new Date();
    endDate.setFullYear(startDate.getFullYear() + 1);

    const resPost = await app.request("/api/contracts", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenTenantA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        accountId,
        contractAmount: "10000.00",
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        status: "Draft",
      }),
    });
    expect(resPost.status).toBe(201);
    const bodyPost = await resPost.json();
    expect(bodyPost.success).toBe(true);
    expect(bodyPost.data.contractAmount).toBe("10000.00");
    expect(bodyPost.data.status).toBe("Draft");
    const contractId = bodyPost.data.id;

    // 4. PATCH contract to Active
    const resPatch = await app.request(`/api/contracts/${contractId}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${tokenTenantA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        status: "Active",
      }),
    });
    expect(resPatch.status).toBe(200);
    const bodyPatch = await resPatch.json();
    expect(bodyPatch.success).toBe(true);
    expect(bodyPatch.data.status).toBe("Active");

    // 5. GET contracts for Account (should have 1)
    const resGet = await app.request(`/api/accounts/${accountId}/contracts`, {
      method: "GET",
      headers: { Authorization: `Bearer ${tokenTenantA}` },
    });
    expect(resGet.status).toBe(200);
    const bodyGet = await resGet.json();
    expect(bodyGet.data).toHaveLength(1);
    expect(bodyGet.data[0].id).toBe(contractId);
    expect(bodyGet.data[0].status).toBe("Active");

    // Verify audit logs
    await withTenant(orgA, mockDb, async () => {
      const logs = await dbStore.auditLogs.findMany();
      const contractLogs = logs.filter((l) => l.recordType === "contracts");
      expect(contractLogs.length).toBeGreaterThanOrEqual(2); // Create and Update
    });
  });

  it("should successfully execute contract renewals and generate renewal opportunities", async () => {
    let accountId = "";
    let contractId = "";

    // Setup Account & Contract under active tenant org A
    await withTenant(orgA, mockDb, async () => {
      const account = await dbStore.accounts.insert({
        orgId: orgA,
        ownerId: "user-a",
        name: "Stark Industries",
        domain: "stark.com",
        custom: null,
      });
      accountId = account.id;

      const startDate = new Date();
      const endDate = new Date();
      endDate.setFullYear(startDate.getFullYear() + 1);

      const contract = await dbStore.contracts.insert({
        orgId: orgA,
        accountId: account.id,
        opportunityId: null,
        contractAmount: "25000.00",
        startDate,
        endDate,
        status: "Active",
      });
      contractId = contract.id;
    });

    // POST /api/contracts/:id/renew with custom 10% escalation markup
    const resRenew = await app.request(`/api/contracts/${contractId}/renew`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenTenantA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        escalationPercentage: 10,
      }),
    });
    expect(resRenew.status).toBe(201);
    const bodyRenew = await resRenew.json();
    expect(bodyRenew.success).toBe(true);

    // Assert the created opportunity details (stage: Qualification, amount: 25000 * 1.10 = 27500.00)
    expect(bodyRenew.data.amount).toBe("27500.00");
    expect(bodyRenew.data.stage).toBe("Qualification");
    expect(bodyRenew.data.name).toContain("Renewal - Stark Industries");

    // Query contract to assert state changed to "Renewed" and linked opportunityId matches
    await withTenant(orgA, mockDb, async () => {
      const contract = await dbStore.contracts.findOne(contractId);
      expect(contract?.status).toBe("Renewed");
      expect(contract?.opportunityId).toBe(bodyRenew.data.id);

      // Verify audit trail logged
      const logs = await dbStore.auditLogs.findMany();
      const renewalLogs = logs.filter((l) => l.action === "renew");
      expect(renewalLogs).toHaveLength(1);
    });
  });

  it("should enforce multi-tenant RLS isolation to prevent cross-tenant queries or mutations", async () => {
    let accountIdA = "";
    let contractIdA = "";

    // 1. Setup Tenant A
    await withTenant(orgA, mockDb, async () => {
      const account = await dbStore.accounts.insert({
        orgId: orgA,
        ownerId: "user-a",
        name: "Tenant A Account",
        domain: "tenant-a.com",
        custom: null,
      });
      accountIdA = account.id;

      const contract = await dbStore.contracts.insert({
        orgId: orgA,
        accountId: accountIdA,
        opportunityId: null,
        contractAmount: "5000.00",
        startDate: new Date(),
        endDate: new Date(),
        status: "Active",
      });
      contractIdA = contract.id;
    });

    // 2. Setup Tenant B
    let accountIdB = "";
    await withTenant(orgB, mockDb, async () => {
      const account = await dbStore.accounts.insert({
        orgId: orgB,
        ownerId: "user-b",
        name: "Tenant B Account",
        domain: "tenant-b.com",
        custom: null,
      });
      accountIdB = account.id;
    });

    // Tenant B attempts to read Tenant A's account contracts via route -> Should return 404
    const resGetLeak = await app.request(
      `/api/accounts/${accountIdA}/contracts`,
      {
        method: "GET",
        headers: { Authorization: `Bearer ${tokenTenantB}` },
      },
    );
    expect(resGetLeak.status).toBe(404);

    // Tenant B attempts to patch Tenant A's contract -> Should return 404
    const resPatchLeak = await app.request(`/api/contracts/${contractIdA}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${tokenTenantB}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        status: "Draft",
      }),
    });
    expect(resPatchLeak.status).toBe(404);

    // Tenant B attempts to renew Tenant A's contract -> Should return 404
    const resRenewLeak = await app.request(
      `/api/contracts/${contractIdA}/renew`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenTenantB}`,
          "Content-Type": "application/json",
        },
      },
    );
    expect(resRenewLeak.status).toBe(404);
  });
});
