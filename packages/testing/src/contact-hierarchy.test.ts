import { createSessionToken } from "@crm/auth";
import { dbStore, mockDb, withTenant } from "@crm/db";
import { beforeEach, describe, expect, it } from "vitest";
import app from "../../../apps/api/src/index";

describe("Contact Hierarchy & Org Chart API & Integration Tests", () => {
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

  it("should support CRUD and hierarchy traversal under strict RLS context", async () => {
    let bossId = "";
    let managerId = "";
    let employeeId = "";

    // 1. Create a 3-tier hierarchy under Tenant A RLS context
    await withTenant(orgA, mockDb, async () => {
      const boss = await dbStore.contacts.insert({
        orgId: orgA,
        ownerId: "user-a",
        accountId: "account-1",
        firstName: "CEO",
        lastName: "Boss",
        email: "boss@acme.com",
        custom: null,
        reportsToId: null,
      });
      bossId = boss.id;

      const manager = await dbStore.contacts.insert({
        orgId: orgA,
        ownerId: "user-a",
        accountId: "account-1",
        firstName: "Sales",
        lastName: "Manager",
        email: "manager@acme.com",
        custom: null,
        reportsToId: bossId,
      });
      managerId = manager.id;

      const employee = await dbStore.contacts.insert({
        orgId: orgA,
        ownerId: "user-a",
        accountId: "account-1",
        firstName: "Junior",
        lastName: "Developer",
        email: "employee@acme.com",
        custom: null,
        reportsToId: managerId,
      });
      employeeId = employee.id;
    });

    // 2. Fetch the hierarchy of the employee
    const resEmployee = await app.request(
      `/api/contacts/${employeeId}/hierarchy`,
      {
        method: "GET",
        headers: { Authorization: `Bearer ${tokenTenantA}` },
      },
    );
    expect(resEmployee.status).toBe(200);
    const bodyEmployee = await resEmployee.json();
    expect(bodyEmployee.success).toBe(true);

    // parentPath should go upwards: [manager, boss]
    expect(bodyEmployee.data.parentPath).toHaveLength(2);
    expect(bodyEmployee.data.parentPath[0].id).toBe(managerId);
    expect(bodyEmployee.data.parentPath[1].id).toBe(bossId);
    expect(bodyEmployee.data.directReports).toHaveLength(0);

    // 3. Fetch the hierarchy of the boss
    const resBoss = await app.request(`/api/contacts/${bossId}/hierarchy`, {
      method: "GET",
      headers: { Authorization: `Bearer ${tokenTenantA}` },
    });
    expect(resBoss.status).toBe(200);
    const bodyBoss = await resBoss.json();
    expect(bodyBoss.success).toBe(true);
    expect(bodyBoss.data.parentPath).toHaveLength(0);
    expect(bodyBoss.data.directReports).toHaveLength(1);
    expect(bodyBoss.data.directReports[0].id).toBe(managerId);
  });

  it("should prevent circular reporting dependencies during hierarchy updates", async () => {
    let bossId = "";
    let managerId = "";
    let employeeId = "";

    // Setup hierarchy under Tenant A
    await withTenant(orgA, mockDb, async () => {
      const boss = await dbStore.contacts.insert({
        orgId: orgA,
        ownerId: "user-a",
        accountId: "account-1",
        firstName: "Alice",
        lastName: "Boss",
        email: "alice@enterprise.com",
        custom: null,
        reportsToId: null,
      });
      bossId = boss.id;

      const manager = await dbStore.contacts.insert({
        orgId: orgA,
        ownerId: "user-a",
        accountId: "account-1",
        firstName: "Bob",
        lastName: "Manager",
        email: "bob@enterprise.com",
        custom: null,
        reportsToId: bossId,
      });
      managerId = manager.id;

      const employee = await dbStore.contacts.insert({
        orgId: orgA,
        ownerId: "user-a",
        accountId: "account-1",
        firstName: "Charlie",
        lastName: "Employee",
        email: "charlie@enterprise.com",
        custom: null,
        reportsToId: managerId,
      });
      employeeId = employee.id;
    });

    // 1. Attempt to set boss's manager to employee (circular!)
    const resCircular = await app.request(`/api/contacts/${bossId}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${tokenTenantA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        reportsToId: employeeId,
      }),
    });
    expect(resCircular.status).toBe(400);
    const bodyCircular = await resCircular.json();
    expect(bodyCircular.error).toContain("circular reporting relationship");

    // 2. Attempt to set a contact as its own manager (circular!)
    const resSelf = await app.request(`/api/contacts/${managerId}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${tokenTenantA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        reportsToId: managerId,
      }),
    });
    expect(resSelf.status).toBe(400);
  });

  it("should enforce strict multi-tenant RLS isolation", async () => {
    let contactAId = "";
    let contactBId = "";

    // 1. Create Contact A in Tenant A
    await withTenant(orgA, mockDb, async () => {
      const contactA = await dbStore.contacts.insert({
        orgId: orgA,
        ownerId: "user-a",
        accountId: "account-1",
        firstName: "Alice",
        lastName: "TenantA",
        email: "alice@tenanta.com",
        custom: null,
      });
      contactAId = contactA.id;
    });

    // 2. Create Contact B in Tenant B
    await withTenant(orgB, mockDb, async () => {
      const contactB = await dbStore.contacts.insert({
        orgId: orgB,
        ownerId: "user-b",
        accountId: "account-2",
        firstName: "Bob",
        lastName: "TenantB",
        email: "bob@tenantb.com",
        custom: null,
      });
      contactBId = contactB.id;
    });

    // 3. Tenant B attempts to read Contact A's hierarchy (should be 404/not found due to RLS)
    const resRead = await app.request(`/api/contacts/${contactAId}/hierarchy`, {
      method: "GET",
      headers: { Authorization: `Bearer ${tokenTenantB}` },
    });
    expect(resRead.status).toBe(404);

    // 4. Tenant B attempts to set Contact A (from Tenant A) as manager of Contact B (should fail)
    const resLink = await app.request(`/api/contacts/${contactBId}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${tokenTenantB}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        reportsToId: contactAId,
      }),
    });
    expect(resLink.status).toBe(400);
    const bodyLink = await resLink.json();
    expect(bodyLink.error).toContain("Manager contact not found");
  });
});
