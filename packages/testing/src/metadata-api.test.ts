import { createSessionToken } from "@crm/auth";
import { dbStore } from "@crm/db";
import { beforeEach, describe, expect, it } from "vitest";
import { createTestApp } from "./_harness";

const app = createTestApp();

describe("Metadata API & Dynamic Field Customization Tests", () => {
  let tokenTenantA: string;
  const orgA = "org-tenant-a";

  beforeEach(async () => {
    dbStore.clear();

    tokenTenantA = await createSessionToken({
      userId: "user-a",
      orgId: orgA,
      roleId: "role-a",
      permissionsMask: 63,
    });
  });

  it("should successfully register custom field definitions and list them", async () => {
    // 1. Register a custom number field for net worth
    const fieldRes1 = await app.request("/api/metadata/fields", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenTenantA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        objectType: "leads",
        apiName: "custom_net_worth",
        label: "Net Worth",
        dataType: "number",
        validationRules: { min: 1000 },
      }),
    });

    expect(fieldRes1.status).toBe(200);
    const body1 = await fieldRes1.json();
    expect(body1.success).toBe(true);
    expect(body1.data.apiName).toBe("custom_net_worth");

    // 2. Register a custom picklist field for priority
    const fieldRes2 = await app.request("/api/metadata/fields", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenTenantA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        objectType: "leads",
        apiName: "custom_priority",
        label: "Priority",
        dataType: "picklist",
        validationRules: { options: ["High", "Medium", "Low"] },
      }),
    });

    expect(fieldRes2.status).toBe(200);

    // 3. List all metadata fields
    const listRes = await app.request("/api/metadata/fields", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${tokenTenantA}`,
      },
    });

    expect(listRes.status).toBe(200);
    const listBody = await listRes.json();
    expect(listBody.data.length).toBe(2);
    expect(listBody.data[0].apiName).toBe("custom_net_worth");
    expect(listBody.data[1].apiName).toBe("custom_priority");
  });

  it("should validate lead custom fields and block invalid values with 400", async () => {
    // Register custom number and picklist rules
    await app.request("/api/metadata/fields", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenTenantA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        objectType: "leads",
        apiName: "custom_net_worth",
        label: "Net Worth",
        dataType: "number",
        validationRules: { min: 1000 },
      }),
    });

    await app.request("/api/metadata/fields", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenTenantA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        objectType: "leads",
        apiName: "custom_priority",
        label: "Priority",
        dataType: "picklist",
        validationRules: { options: ["High", "Medium", "Low"] },
      }),
    });

    // 1. Create a lead with invalid custom fields (net worth below min, invalid picklist option)
    const invalidRes = await app.request("/api/leads", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenTenantA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: "test@domain.com",
        company: "Test Corp",
        custom: {
          custom_net_worth: 500, // min is 1000
          custom_priority: "Urgent", // not in option list
        },
      }),
    });

    expect(invalidRes.status).toBe(400);
    const invalidBody = await invalidRes.json();
    expect(invalidBody.error).toBe("Validation failed");
    expect(invalidBody.errors.length).toBe(2);
    expect(invalidBody.errors).toContain(
      "Field 'custom_net_worth' must be at least 1000.",
    );
    expect(invalidBody.errors).toContain(
      "Field 'custom_priority' value must be one of: High, Medium, Low.",
    );

    // 2. Create a lead with valid custom fields -> Succeeds
    const validRes = await app.request("/api/leads", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenTenantA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: "test@domain.com",
        company: "Test Corp",
        custom: {
          custom_net_worth: 5000,
          custom_priority: "High",
        },
      }),
    });

    expect(validRes.status).toBe(200);
    const validBody = await validRes.json();
    expect(validBody.success).toBe(true);
    expect(validBody.data.custom).toEqual({
      custom_net_worth: 5000,
      custom_priority: "High",
    });
  });

  it("should compile dynamic form layouts correctly, pushing unassigned fields into a fallback section", async () => {
    // 1. Register two custom fields
    await app.request("/api/metadata/fields", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenTenantA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        objectType: "leads",
        apiName: "custom_priority",
        label: "Priority",
        dataType: "picklist",
        validationRules: { options: ["High", "Medium", "Low"] },
      }),
    });

    await app.request("/api/metadata/fields", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenTenantA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        objectType: "leads",
        apiName: "custom_notes",
        label: "Notes",
        dataType: "text",
      }),
    });

    // 2. Configure form layout sections where ONLY custom_priority is explicitly placed
    const layoutRes = await app.request("/api/metadata/layouts/leads", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenTenantA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sections: [
          { title: "Standard Header", fields: ["name", "email"] },
          { title: "Priority Info", fields: ["custom_priority"] },
        ],
      }),
    });

    expect(layoutRes.status).toBe(200);

    // 3. Retrieve compiled layout for leads
    const retrieveRes = await app.request("/api/metadata/layouts/leads", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${tokenTenantA}`,
      },
    });

    expect(retrieveRes.status).toBe(200);
    const retrieveBody = await retrieveRes.json();
    expect(retrieveBody.success).toBe(true);

    const sections = retrieveBody.data.sections;
    // Standard Header, Priority Info, and fallback "Additional Custom Fields" for custom_notes!
    expect(sections.length).toBe(3);
    expect(sections[0].title).toBe("Standard Header");
    expect(sections[1].title).toBe("Priority Info");
    expect(sections[1].fields).toContain("custom_priority");

    expect(sections[2].title).toBe("Additional Custom Fields");
    expect(sections[2].fields).toContain("custom_notes");
    expect(sections[2].fields).not.toContain("custom_priority");
  });
});
