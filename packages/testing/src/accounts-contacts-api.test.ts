import { createSessionToken } from "@crm/auth";
import { dbStore, mockDb, withTenant } from "@crm/db";
import { beforeEach, describe, expect, it } from "vitest";
import { createTestApp } from "./_harness";

const app = createTestApp();

describe("Accounts & Contacts REST API Tests", () => {
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

  it("should successfully retrieve lists of accounts and contacts separated by tenant RLS", async () => {
    // Insert Account & Contact for Tenant A
    await withTenant(orgA, mockDb, async () => {
      await dbStore.accounts.insert({
        orgId: orgA,
        ownerId: "user-a",
        name: "Acme Corp",
        domain: "acme.com",
        custom: null,
      });

      await dbStore.contacts.insert({
        orgId: orgA,
        ownerId: "user-a",
        accountId: "dummy-id",
        firstName: "John",
        lastName: "Doe",
        email: "john@acme.com",
        custom: null,
      });
    });

    // Insert Account & Contact for Tenant B
    await withTenant(orgB, mockDb, async () => {
      await dbStore.accounts.insert({
        orgId: orgB,
        ownerId: "user-b",
        name: "Stark Industries",
        domain: "stark.com",
        custom: null,
      });

      await dbStore.contacts.insert({
        orgId: orgB,
        ownerId: "user-b",
        accountId: "dummy-id-2",
        firstName: "Tony",
        lastName: "Stark",
        email: "tony@stark.com",
        custom: null,
      });
    });

    // 1. GET /api/accounts for Tenant A -> returns Acme Corp
    const accResA = await app.request("/api/accounts", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${tokenTenantA}`,
      },
    });
    expect(accResA.status).toBe(200);
    const accDataA = await accResA.json();
    expect(accDataA.success).toBe(true);
    expect(accDataA.data.length).toBe(1);
    expect(accDataA.data[0].name).toBe("Acme Corp");

    const accountIdA = accDataA.data[0].id;

    // 2. GET /api/accounts for Tenant B -> returns Stark Industries
    const accResB = await app.request("/api/accounts", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${tokenTenantB}`,
      },
    });
    expect(accResB.status).toBe(200);
    const accDataB = await accResB.json();
    expect(accDataB.success).toBe(true);
    expect(accDataB.data.length).toBe(1);
    expect(accDataB.data[0].name).toBe("Stark Industries");

    // 3. GET /api/contacts for Tenant A -> returns John Doe
    const conResA = await app.request("/api/contacts", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${tokenTenantA}`,
      },
    });
    expect(conResA.status).toBe(200);
    const conDataA = await conResA.json();
    expect(conDataA.success).toBe(true);
    expect(conDataA.data.length).toBe(1);
    expect(conDataA.data[0].firstName).toBe("John");

    const contactIdA = conDataA.data[0].id;

    // 4. GET /api/contacts for Tenant B -> returns Tony Stark
    const conResB = await app.request("/api/contacts", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${tokenTenantB}`,
      },
    });
    expect(conResB.status).toBe(200);
    const conDataB = await conResB.json();
    expect(conDataB.success).toBe(true);
    expect(conDataB.data.length).toBe(1);
    expect(conDataB.data[0].firstName).toBe("Tony");

    // 5. GET /api/accounts/:id for Tenant A retrieving Tenant A's account
    const accOneResA = await app.request(`/api/accounts/${accountIdA}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${tokenTenantA}`,
      },
    });
    expect(accOneResA.status).toBe(200);
    const accOneDataA = await accOneResA.json();
    expect(accOneDataA.success).toBe(true);
    expect(accOneDataA.data.name).toBe("Acme Corp");

    // 6. GET /api/accounts/:id for Tenant B attempting to retrieve Tenant A's account -> 404
    const accOneResCross = await app.request(`/api/accounts/${accountIdA}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${tokenTenantB}`,
      },
    });
    expect(accOneResCross.status).toBe(404);

    // 7. GET /api/contacts/:id for Tenant A retrieving Tenant A's contact
    const conOneResA = await app.request(`/api/contacts/${contactIdA}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${tokenTenantA}`,
      },
    });
    expect(conOneResA.status).toBe(200);
    const conOneDataA = await conOneResA.json();
    expect(conOneDataA.success).toBe(true);
    expect(conOneDataA.data.firstName).toBe("John");

    // 8. GET /api/contacts/:id for Tenant B attempting to retrieve Tenant A's contact -> 404
    const conOneResCross = await app.request(`/api/contacts/${contactIdA}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${tokenTenantB}`,
      },
    });
    expect(conOneResCross.status).toBe(404);
  });
});
