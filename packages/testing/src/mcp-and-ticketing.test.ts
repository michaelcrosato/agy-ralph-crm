import { createSessionToken } from "@crm/auth";
import { dbStore } from "@crm/db";
import { beforeEach, describe, expect, it } from "vitest";
import app from "../../../apps/api/src/index";

describe("Support Ticketing & MCP Execution Engine Tests", () => {
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

  it("should successfully manage support tickets inside service-lite via REST API", async () => {
    // 1. Create a support ticket for Tenant A
    const createRes = await app.request("/api/tickets", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenTenantA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contactId: "contact-111",
        subject: "Checkout page is throwing 500 error",
      }),
    });

    expect(createRes.status).toBe(200);
    const bodyCreate = await createRes.json();
    expect(bodyCreate.success).toBe(true);
    expect(bodyCreate.data.id).toBeDefined();
    expect(bodyCreate.data.status).toBe("Open");
    expect(bodyCreate.data.subject).toBe("Checkout page is throwing 500 error");

    const ticketId = bodyCreate.data.id;

    // 2. List support tickets for Tenant A
    const listResA = await app.request("/api/tickets", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${tokenTenantA}`,
      },
    });
    expect(listResA.status).toBe(200);
    const bodyListA = await listResA.json();
    expect(bodyListA.data.length).toBe(1);

    // 3. List support tickets for Tenant B -> returns empty
    const listResB = await app.request("/api/tickets", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${tokenTenantB}`,
      },
    });
    expect(listResB.status).toBe(200);
    const bodyListB = await listResB.json();
    expect(bodyListB.data.length).toBe(0);

    // 4. Resolve support ticket
    const resolveRes = await app.request(`/api/tickets/${ticketId}/resolve`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenTenantA}`,
      },
    });
    expect(resolveRes.status).toBe(200);
    const bodyResolve = await resolveRes.json();
    expect(bodyResolve.success).toBe(true);
    expect(bodyResolve.data.status).toBe("Resolved");
  });

  it("should execute Model Context Protocol (MCP) tool calls strictly honoring tenant RLS limits", async () => {
    // 1. Tenant A inserts an Account
    const accRes = await app.request("/api/leads", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenTenantA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: "elon@spacex.com",
        company: "SpaceX",
      }),
    });
    const leadData = await accRes.json();
    const leadId = leadData.data.id;

    const convertRes = await app.request(`/api/leads/${leadId}/convert`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenTenantA}`,
      },
    });
    const convertData = await convertRes.json();
    const accountId = convertData.accountId;

    // 2. Tenant A calls crm_get_account via MCP tool executor -> returns SpaceX Account details
    const mcpResA = await app.request("/mcp/tools/call", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenTenantA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "crm_get_account",
        arguments: { accountId },
      }),
    });

    expect(mcpResA.status).toBe(200);
    const mcpDataA = await mcpResA.json();
    expect(mcpDataA.content).toBeDefined();
    const accObjA = JSON.parse(mcpDataA.content[0].text);
    expect(accObjA.id).toBe(accountId);
    expect(accObjA.name).toBe("SpaceX");

    // 3. Tenant B attempts to call crm_get_account for Tenant A's account ID -> returns null/denied under active RLS
    const mcpResB = await app.request("/mcp/tools/call", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenTenantB}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "crm_get_account",
        arguments: { accountId },
      }),
    });

    expect(mcpResB.status).toBe(200);
    const mcpDataB = await mcpResB.json();
    expect(mcpDataB.content[0].text).toBe("null"); // Secured and isolated!
  });
});
