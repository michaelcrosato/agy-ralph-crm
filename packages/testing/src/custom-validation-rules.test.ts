import { createSessionToken } from "@crm/auth";
import { dbStore, mockDb, withTenant } from "@crm/db";
import { beforeEach, describe, expect, it } from "vitest";
import app from "../../../apps/api/src/index";

describe("Custom Validation Rules API & Integration Tests", () => {
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

  it("should support CRUD on validation rules under strict tenant context", async () => {
    // 1. Create a validation rule for Tenant A
    const resCreate = await app.request("/api/metadata/validation-rules", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenTenantA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "Min Lead Score for working status",
        description: "Checks that custom score field is set",
        objectType: "leads",
        errorMessage:
          "Lead custom score must be greater than 10 for Working status",
        isActive: 1,
        criteria: [
          { field: "status", operator: "equals", value: "Working" },
          { field: "custom.score", operator: "less_than", value: "11" },
        ],
      }),
    });
    expect(resCreate.status).toBe(200);
    const bodyCreate = await resCreate.json();
    expect(bodyCreate.success).toBe(true);
    expect(bodyCreate.data.name).toBe("Min Lead Score for working status");
    expect(bodyCreate.data.orgId).toBe(orgA);
    const ruleId = bodyCreate.data.id;

    // 2. Fetch validation rules for Tenant A
    const resList = await app.request("/api/metadata/validation-rules", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${tokenTenantA}`,
      },
    });
    expect(resList.status).toBe(200);
    const bodyList = await resList.json();
    expect(bodyList.data).toHaveLength(1);
    expect(bodyList.data[0].name).toBe("Min Lead Score for working status");

    // 3. Verify Tenant B sees 0 validation rules
    const resListB = await app.request("/api/metadata/validation-rules", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${tokenTenantB}`,
      },
    });
    expect(resListB.status).toBe(200);
    const bodyListB = await resListB.json();
    expect(bodyListB.data).toHaveLength(0);

    // 4. Delete the validation rule for Tenant A
    const resDelete = await app.request(
      `/api/metadata/validation-rules/${ruleId}`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${tokenTenantA}`,
        },
      },
    );
    expect(resDelete.status).toBe(200);

    // 5. Verify it's gone
    const resListAfter = await app.request("/api/metadata/validation-rules", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${tokenTenantA}`,
      },
    });
    const bodyListAfter = await resListAfter.json();
    expect(bodyListAfter.data).toHaveLength(0);
  });

  it("should validate custom validation rules when creating and updating leads", async () => {
    // Setup a validation rule for Tenant A
    // Rules: fail if status is 'Working' AND custom.score is <= 10 (less than 11)
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

    // 1. Create a lead with valid custom validation values (status: 'New', custom.score: 5) - should succeed
    const resValid1 = await app.request("/api/leads", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenTenantA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        company: "Valid 1 Corp",
        status: "New",
        custom: {
          score: 5,
        },
      }),
    });
    expect(resValid1.status).toBe(200);
    const bodyValid1 = await resValid1.json();
    expect(bodyValid1.success).toBe(true);
    const leadId = bodyValid1.data.id;

    // 2. Create a lead with invalid custom validation values (status: 'Working', custom.score: 5) - should fail
    const resInvalid1 = await app.request("/api/leads", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenTenantA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        company: "Invalid 1 Corp",
        status: "Working",
        custom: {
          score: 5,
        },
      }),
    });
    expect(resInvalid1.status).toBe(400);
    const bodyInvalid1 = await resInvalid1.json();
    expect(bodyInvalid1.error).toBe(
      "Lead score must be greater than 10 to start working",
    );

    // 3. Patch the valid lead to violate the rule (status: 'Working') - should fail!
    const resPatchInvalid = await app.request(`/api/leads/${leadId}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${tokenTenantA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        status: "Working",
      }),
    });
    expect(resPatchInvalid.status).toBe(400);
    const bodyPatchInvalid = await resPatchInvalid.json();
    expect(bodyPatchInvalid.error).toBe(
      "Lead score must be greater than 10 to start working",
    );

    // 4. Patch the valid lead to have a valid status and score (status: 'Working', custom.score: 15) - should succeed!
    const resPatchValid = await app.request(`/api/leads/${leadId}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${tokenTenantA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        status: "Working",
        custom: {
          score: 15,
        },
      }),
    });
    expect(resPatchValid.status).toBe(200);
  });
});
