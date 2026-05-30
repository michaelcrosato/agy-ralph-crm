import { createSessionToken } from "@crm/auth";
import { dbStore, mockDb, store, withTenant } from "@crm/db";
import { beforeEach, describe, expect, it } from "vitest";
import { createTestApp } from "./_harness";

const app = createTestApp();

describe("Public Web-to-Lead Capture API & RLS Tests", () => {
  let tokenTenantA: string;
  let tokenTenantB: string;

  const orgA = "org-tenant-a";
  const orgB = "org-tenant-b";

  beforeEach(async () => {
    // Clear mock store before each test run
    store.leads = [];
    store.auditLogs = [];
    store.fieldDefinitions = [];
    store.leadAssignmentRules = [];
    store.leadAssignmentRuleEntries = [];
    store.webhooks = [];
    store.webhookOutbox = [];

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

  it("should successfully capture a lead publicly and assign to fallback owner", async () => {
    const payload = {
      orgId: orgA,
      lastName: "Doe",
      email: "doe@example.com",
      company: "Acme Corp",
      firstName: "John",
    };

    const res = await app.request("/api/public/web-to-lead", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.id).toBeDefined();
    expect(body.data.email).toBe("doe@example.com");
    expect(body.data.ownerId).toBe("user-system");

    // Verify record exists under Tenant A isolation context
    await withTenant(orgA, mockDb, async () => {
      const lead = await dbStore.leads.findOne(body.data.id);
      expect(lead).not.toBeNull();
      expect(lead?.email).toBe("doe@example.com");

      // Verify audit trail record was generated
      const logs = await dbStore.auditLogs.findMany();
      const leadLog = logs.find((l) => l.recordId === body.data.id);
      expect(leadLog).toBeDefined();
      expect(leadLog?.action).toBe("create");
    });
  });

  it("should enforce dynamic custom field schema validation on public submission", async () => {
    // 1. Inject custom field definition for Tenant A
    await withTenant(orgA, mockDb, async () => {
      await dbStore.fieldDefinitions.insert({
        orgId: orgA,
        objectType: "leads",
        apiName: "employeeCount",
        label: "Employee Count",
        dataType: "number",
        validationRules: { min: 10, max: 1000 },
      });
    });

    // 2. Submit invalid value (failing validation rules)
    const invalidPayload = {
      orgId: orgA,
      lastName: "Smith",
      email: "smith@acme.com",
      custom: { employeeCount: 5 }, // too low (min 10)
    };

    const resFail = await app.request("/api/public/web-to-lead", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(invalidPayload),
    });

    expect(resFail.status).toBe(400);
    const bodyFail = await resFail.json();
    expect(bodyFail.error).toBe("Validation failed");

    // 3. Submit valid value
    const validPayload = {
      orgId: orgA,
      lastName: "Smith",
      email: "smith@acme.com",
      custom: { employeeCount: 150 }, // valid
    };

    const resPass = await app.request("/api/public/web-to-lead", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validPayload),
    });

    expect(resPass.status).toBe(201);
    const bodyPass = await resPass.json();
    expect(bodyPass.success).toBe(true);
    expect(bodyPass.data.custom.employeeCount).toBe(150);
  });

  it("should integrate with active Lead Assignment Rules (direct and round-robin queue)", async () => {
    // 1. Set up active rule and entries for Tenant A
    await withTenant(orgA, mockDb, async () => {
      const rule = await dbStore.leadAssignmentRules.insert({
        orgId: orgA,
        name: "Acme Web Lead Routing",
        isActive: 1,
      });

      // Entry 1: Direct route to user-rep-1 if company equals "Google"
      await dbStore.leadAssignmentRuleEntries.insert({
        orgId: orgA,
        ruleId: rule.id,
        sortOrder: 1,
        routingMethod: "direct",
        routingUserIds: ["user-rep-1"],
        lastAssignedIndex: -1,
        criteria: [{ field: "company", operator: "equals", value: "Google" }],
      });

      // Entry 2: Round-Robin route between user-rep-rr-1 & user-rep-rr-2 if email contains "apple.com"
      await dbStore.leadAssignmentRuleEntries.insert({
        orgId: orgA,
        ruleId: rule.id,
        sortOrder: 2,
        routingMethod: "round_robin",
        routingUserIds: ["user-rep-rr-1", "user-rep-rr-2"],
        lastAssignedIndex: -1,
        criteria: [
          { field: "email", operator: "contains", value: "apple.com" },
        ],
      });
    });

    // 2. Submit matching Direct Route Lead
    const directPayload = {
      orgId: orgA,
      lastName: "Pichai",
      email: "sundar@google.com",
      company: "Google",
    };

    const resDirect = await app.request("/api/public/web-to-lead", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(directPayload),
    });
    expect(resDirect.status).toBe(201);
    const bodyDirect = await resDirect.json();
    expect(bodyDirect.data.ownerId).toBe("user-rep-1");

    // 3. Submit matching Round-Robin Lead (first hit)
    const rrPayload1 = {
      orgId: orgA,
      lastName: "Jobs",
      email: "steve@apple.com",
    };
    const resRR1 = await app.request("/api/public/web-to-lead", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(rrPayload1),
    });
    expect(resRR1.status).toBe(201);
    const bodyRR1 = await resRR1.json();
    expect(bodyRR1.data.ownerId).toBe("user-rep-rr-1");

    // 4. Submit matching Round-Robin Lead (second hit)
    const rrPayload2 = {
      orgId: orgA,
      lastName: "Cook",
      email: "tim@apple.com",
    };
    const resRR2 = await app.request("/api/public/web-to-lead", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(rrPayload2),
    });
    expect(resRR2.status).toBe(201);
    const bodyRR2 = await resRR2.json();
    expect(bodyRR2.data.ownerId).toBe("user-rep-rr-2");
  });

  it("should maintain strict multi-tenant RLS isolation", async () => {
    // 1. Submit lead publicly to Tenant A
    const payload = {
      orgId: orgA,
      lastName: "TenantA-Lead",
      email: "lead@tenant-a.com",
    };

    const res = await app.request("/api/public/web-to-lead", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    expect(res.status).toBe(201);
    const leadId = (await res.json()).data.id;

    // 2. Try to fetch the lead using Tenant B's session token
    const resGetB = await app.request(`/api/leads/${leadId}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${tokenTenantB}` },
    });
    expect(resGetB.status).toBe(404); // Should be 404/not found under Tenant B's context

    // 3. Successfully fetch using Tenant A's session token
    const resGetA = await app.request(`/api/leads/${leadId}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${tokenTenantA}` },
    });
    expect(resGetA.status).toBe(200);
    const bodyGetA = await resGetA.json();
    expect(bodyGetA.success).toBe(true);
    expect(bodyGetA.data.email).toBe("lead@tenant-a.com");
  });
});
