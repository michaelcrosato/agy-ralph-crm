import { createSessionToken } from "@crm/auth";
import { dbStore } from "@crm/db";
import { beforeEach, describe, expect, it } from "vitest";
import { createTestApp } from "./_harness";

const app = createTestApp();

describe("Workflow API & Event-Triggered Automation Tests", () => {
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

  it("should successfully register workflow rules and list them", async () => {
    // 1. Register a rule for Tenant A
    const registerRes = await app.request("/api/workflows", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenTenantA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "Alert on Closed Won Deals",
        triggerEvent: "opportunity.stage_changed",
        conditions: {
          field: "stage",
          operator: "equals",
          value: "Qualification",
        },
        actions: [
          {
            type: "notification",
            target: "Big Opportunity is now in Qualification!",
          },
        ],
      }),
    });

    expect(registerRes.status).toBe(200);
    const registerBody = await registerRes.json();
    expect(registerBody.success).toBe(true);
    expect(registerBody.data.name).toBe("Alert on Closed Won Deals");

    // 2. List workflow rules for Tenant A
    const listResA = await app.request("/api/workflows", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${tokenTenantA}`,
      },
    });
    expect(listResA.status).toBe(200);
    const bodyA = await listResA.json();
    expect(bodyA.data.length).toBe(1);

    // 3. List workflow rules for Tenant B -> returns empty
    const listResB = await app.request("/api/workflows", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${tokenTenantB}`,
      },
    });
    expect(listResB.status).toBe(200);
    const bodyB = await listResB.json();
    expect(bodyB.data.length).toBe(0);
  });

  it("should trigger workflow actions automatically during lead conversion when opportunity stage matches conditions", async () => {
    // 1. Register Tenant A workflow rule triggering notification when opportunity is in 'Qualification'
    await app.request("/api/workflows", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenTenantA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "Qualification Alert",
        triggerEvent: "opportunity.stage_changed",
        conditions: {
          field: "stage",
          operator: "equals",
          value: "Qualification",
        },
        actions: [
          {
            type: "notification",
            target: "Alert: A new deal entered Qualification stage!",
          },
          {
            type: "webhook",
            target: "https://api.external.com/webhooks/qualification",
          },
        ],
      }),
    });

    // 2. Create a lead first
    const leadRes = await app.request("/api/leads", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenTenantA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: "tony@stark.com",
        company: "Stark Industries",
      }),
    });
    const leadBody = await leadRes.json();
    const leadId = leadBody.data.id;

    // 3. Convert lead, creating opportunity (which triggers the Qualification stage event!)
    const convertRes = await app.request(`/api/leads/${leadId}/convert`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenTenantA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        opportunityName: "Iron Man Suit Deal",
        opportunityAmount: "1000000",
      }),
    });

    expect(convertRes.status).toBe(200);
    const convertBody = await convertRes.json();
    expect(convertBody.success).toBe(true);

    // 4. Assert that the workflow rules matched and executed!
    expect(convertBody.workflow).toBeDefined();
    expect(convertBody.workflow.dispatchedWebhooks.length).toBe(1);
    expect(convertBody.workflow.notificationsCreated.length).toBe(1);

    expect(convertBody.workflow.dispatchedWebhooks[0]).toContain(
      "https://api.external.com/webhooks/qualification",
    );
    expect(convertBody.workflow.notificationsCreated[0]).toContain(
      "Alert: A new deal entered Qualification stage!",
    );
  });
});
