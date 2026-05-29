import { createSessionToken } from "@crm/auth";
import { dbStore, mockDb, store, withTenant } from "@crm/db";
import { beforeEach, describe, expect, it } from "vitest";
import app from "../../../apps/api/src/index";

describe("Dependent Picklists API & Integration Tests", () => {
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

  it("should support CRUD on picklist dependencies under strict tenant context", async () => {
    // 1. Create a picklist dependency for Tenant A (Country controls State)
    const resCreate = await app.request("/api/metadata/picklist-dependencies", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenTenantA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        objectType: "leads",
        parentField: "custom.country",
        dependentField: "custom.state",
        dependencyMap: {
          USA: ["California", "New York"],
          Canada: ["Ontario", "Quebec"],
        },
      }),
    });
    expect(resCreate.status).toBe(200);
    const bodyCreate = await resCreate.json();
    expect(bodyCreate.success).toBe(true);
    expect(bodyCreate.data.parentField).toBe("custom.country");
    expect(bodyCreate.data.orgId).toBe(orgA);
    const dependencyId = bodyCreate.data.id;

    // 2. Fetch dependencies for Tenant A
    const resList = await app.request("/api/metadata/picklist-dependencies", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${tokenTenantA}`,
      },
    });
    expect(resList.status).toBe(200);
    const bodyList = await resList.json();
    expect(bodyList.data).toHaveLength(1);
    expect(bodyList.data[0].parentField).toBe("custom.country");

    // 3. Verify Tenant B sees 0 dependencies
    const resListB = await app.request("/api/metadata/picklist-dependencies", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${tokenTenantB}`,
      },
    });
    expect(resListB.status).toBe(200);
    const bodyListB = await resListB.json();
    expect(bodyListB.data).toHaveLength(0);

    // 4. Delete the dependency for Tenant A
    const resDelete = await app.request(
      `/api/metadata/picklist-dependencies/${dependencyId}`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${tokenTenantA}`,
        },
      },
    );
    expect(resDelete.status).toBe(200);

    // 5. Verify it's gone
    const resListAfter = await app.request(
      "/api/metadata/picklist-dependencies",
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${tokenTenantA}`,
        },
      },
    );
    const bodyListAfter = await resListAfter.json();
    expect(bodyListAfter.data).toHaveLength(0);
  });

  it("should validate picklist dependencies when creating and updating leads", async () => {
    // Setup a picklist dependency for Tenant A (Country controls State)
    await withTenant(orgA, mockDb, async () => {
      await dbStore.picklistDependencies.insert({
        orgId: orgA,
        objectType: "leads",
        parentField: "custom.country",
        dependentField: "custom.state",
        dependencyMap: {
          USA: ["California", "New York"],
          Canada: ["Ontario", "Quebec"],
        },
      });
    });

    // 1. Create a lead with valid dependent values (USA -> California)
    const resValid = await app.request("/api/leads", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenTenantA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        company: "Valid Corp",
        status: "New",
        custom: {
          country: "USA",
          state: "California",
        },
      }),
    });
    expect(resValid.status).toBe(200);
    const bodyValid = await resValid.json();
    expect(bodyValid.success).toBe(true);
    const leadId = bodyValid.data.id;

    // 2. Create a lead with invalid dependent values (USA -> Ontario) - should fail!
    const resInvalid = await app.request("/api/leads", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenTenantA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        company: "Invalid Corp",
        status: "New",
        custom: {
          country: "USA",
          state: "Ontario",
        },
      }),
    });
    expect(resInvalid.status).toBe(400);
    const bodyInvalid = await resInvalid.json();
    expect(bodyInvalid.error).toContain("is not allowed for dependent field");

    // 3. Patch the valid lead to have an invalid state (USA -> Quebec) - should fail!
    const resPatchInvalid = await app.request(`/api/leads/${leadId}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${tokenTenantA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        custom: {
          state: "Quebec",
        },
      }),
    });
    expect(resPatchInvalid.status).toBe(400);

    // 4. Patch the valid lead to have a valid state (Canada -> Quebec) - should succeed!
    const resPatchValid = await app.request(`/api/leads/${leadId}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${tokenTenantA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        custom: {
          country: "Canada",
          state: "Quebec",
        },
      }),
    });
    expect(resPatchValid.status).toBe(200);
  });
});
