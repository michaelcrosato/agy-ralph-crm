import { createSessionToken } from "@crm/auth";
import { dbStore, mockDb, withTenant } from "@crm/db";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearValidationCaches } from "../../../apps/api/src/lib/validation";
import { createTestApp } from "./_harness";

const app = createTestApp();

describe("Validation Caching & Dynamic Invalidation Tests", () => {
  let tokenTenantA: string;
  const orgA = "org-tenant-a";

  beforeEach(async () => {
    await dbStore.clear();
    clearValidationCaches();
    vi.restoreAllMocks();

    tokenTenantA = await createSessionToken({
      userId: "user-a",
      orgId: orgA,
      roleId: "role-a",
      permissionsMask: 7,
    });
  });

  it("should cache picklist dependencies and invalidate them on mutation", async () => {
    // 1. Setup a picklist dependency for Tenant A
    await withTenant(orgA, mockDb, async () => {
      await dbStore.picklistDependencies.insert({
        orgId: orgA,
        objectType: "leads",
        parentField: "custom.country",
        dependentField: "custom.state",
        dependencyMap: {
          USA: ["California"],
        },
      });
    });

    // Spy on findMany
    const findManySpy = vi.spyOn(dbStore.picklistDependencies, "findMany");

    // 2. Validate lead multiple times
    const payload = {
      company: "Test Corp",
      status: "New",
      custom: { country: "USA", state: "California" },
    };

    // First request - should call findMany
    let res = await app.request("/api/leads", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenTenantA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    expect(res.status).toBe(200);
    expect(findManySpy).toHaveBeenCalledTimes(1);

    // Second request - should hit cache (no findMany call)
    res = await app.request("/api/leads", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenTenantA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    expect(res.status).toBe(200);
    expect(findManySpy).toHaveBeenCalledTimes(1); // Still 1!

    // 3. Mutate (insert a new picklist dependency) - should invalidate the cache
    await withTenant(orgA, mockDb, async () => {
      await dbStore.picklistDependencies.insert({
        orgId: orgA,
        objectType: "leads",
        parentField: "custom.region",
        dependentField: "custom.subregion",
        dependencyMap: {
          North: ["Subnorth"],
        },
      });
    });

    // 4. Validate lead again - should call findMany again because cache was invalidated
    res = await app.request("/api/leads", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenTenantA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    expect(res.status).toBe(200);
    expect(findManySpy).toHaveBeenCalledTimes(2); // Incremented!
  });

  it("should cache custom validation rules and invalidate them on mutation", async () => {
    // 1. Setup a validation rule for Tenant A
    await withTenant(orgA, mockDb, async () => {
      await dbStore.validationRules.insert({
        orgId: orgA,
        name: "Min Score rule",
        description: "Checks custom score minimum",
        objectType: "leads",
        errorMessage: "Lead score must be greater than 10 to start working",
        isActive: 1,
        criteria: [
          { field: "status", operator: "equals", value: "Working" },
          { field: "custom.score", operator: "less_than", value: "11" },
        ],
      });
    });

    // Spy on findMany
    const findManySpy = vi.spyOn(dbStore.validationRules, "findMany");

    const payload = {
      company: "Test Corp",
      status: "New",
      custom: { score: 5 },
    };

    // First request - should call findMany
    let res = await app.request("/api/leads", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenTenantA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    expect(res.status).toBe(200);
    expect(findManySpy).toHaveBeenCalledTimes(1);

    // Second request - should hit cache
    res = await app.request("/api/leads", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenTenantA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    expect(res.status).toBe(200);
    expect(findManySpy).toHaveBeenCalledTimes(1); // Still 1!

    // 3. Mutate (insert a new validation rule) - should invalidate the cache
    await withTenant(orgA, mockDb, async () => {
      await dbStore.validationRules.insert({
        orgId: orgA,
        name: "Another Rule",
        objectType: "leads",
        errorMessage: "Error message",
        isActive: 1,
        criteria: [{ field: "status", operator: "equals", value: "Closed" }],
      });
    });

    // 4. Validate again - should call findMany because cache was invalidated
    res = await app.request("/api/leads", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenTenantA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    expect(res.status).toBe(200);
    expect(findManySpy).toHaveBeenCalledTimes(2); // Incremented!
  });

  it("should support manual cache clearing helper", async () => {
    // 1. Setup a validation rule
    await withTenant(orgA, mockDb, async () => {
      await dbStore.validationRules.insert({
        orgId: orgA,
        name: "Min Score rule",
        description: "Checks custom score minimum",
        objectType: "leads",
        errorMessage: "Lead score must be greater than 10 to start working",
        isActive: 1,
        criteria: [
          { field: "status", operator: "equals", value: "Working" },
          { field: "custom.score", operator: "less_than", value: "11" },
        ],
      });
    });

    const findManySpy = vi.spyOn(dbStore.validationRules, "findMany");
    const payload = {
      company: "Test Corp",
      status: "New",
      custom: { score: 5 },
    };

    let res = await app.request("/api/leads", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenTenantA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    expect(res.status).toBe(200);
    expect(findManySpy).toHaveBeenCalledTimes(1);

    // hit cache
    res = await app.request("/api/leads", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenTenantA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    expect(res.status).toBe(200);
    expect(findManySpy).toHaveBeenCalledTimes(1);

    // Call manual clear validation helper
    clearValidationCaches();

    // should hit findMany again
    res = await app.request("/api/leads", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenTenantA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    expect(res.status).toBe(200);
    expect(findManySpy).toHaveBeenCalledTimes(2);
  });
});
