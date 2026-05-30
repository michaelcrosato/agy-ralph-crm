import { createSessionToken } from "@crm/auth";
import { dbStore, mockDb, withTenant } from "@crm/db";
import { beforeEach, describe, expect, it } from "vitest";
import { createTestApp } from "./_harness";

const app = createTestApp();

describe("Support Ticketing Model Context Protocol (MCP) Integration Tests", () => {
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

  it("should list available tools including new ticket MCP tools", async () => {
    const res = await app.request("/mcp/tools", {
      method: "GET",
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.tools).toBeDefined();

    const toolNames = body.tools.map((t: { name: string }) => t.name);
    expect(toolNames).toContain("crm_get_ticket");
    expect(toolNames).toContain("crm_list_tickets");
    expect(toolNames).toContain("crm_create_ticket");
    expect(toolNames).toContain("crm_add_ticket_comment");
    expect(toolNames).toContain("crm_apply_ticket_macro");
  });

  it("should execute support ticket MCP operations under strict RLS isolation", async () => {
    // 1. List tickets initially -> empty
    const listRes1 = await app.request("/mcp/tools/call", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenTenantA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "crm_list_tickets",
        arguments: {},
      }),
    });
    expect(listRes1.status).toBe(200);
    const listData1 = await listRes1.json();
    const tickets1 = JSON.parse(listData1.content[0].text);
    expect(tickets1.length).toBe(0);

    // 2. Create ticket via MCP
    const createRes = await app.request("/mcp/tools/call", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenTenantA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "crm_create_ticket",
        arguments: {
          subject: "Database connection timeouts",
          body: "Our prod database is timing out under heavy loads.",
          email: "ops@customer-a.com",
          firstName: "John",
          lastName: "Ops",
          priority: "High",
        },
      }),
    });
    expect(createRes.status).toBe(200);
    const createData = await createRes.json();
    expect(createData.content).toBeDefined();
    const ticket = JSON.parse(createData.content[0].text);
    expect(ticket.id).toBeDefined();
    expect(ticket.subject).toBe("Database connection timeouts");
    expect(ticket.status).toBe("Open");
    expect(ticket.priority).toBe("High");

    const ticketId = ticket.id;

    // 3. List tickets again for Tenant A -> contains 1 ticket
    const listRes2 = await app.request("/mcp/tools/call", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenTenantA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "crm_list_tickets",
        arguments: {},
      }),
    });
    const listData2 = await listRes2.json();
    const tickets2 = JSON.parse(listData2.content[0].text);
    expect(tickets2.length).toBe(1);
    expect(tickets2[0].id).toBe(ticketId);

    // 4. List tickets for Tenant B -> returns 0 (RLS Isolation)
    const listResB = await app.request("/mcp/tools/call", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenTenantB}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "crm_list_tickets",
        arguments: {},
      }),
    });
    const listDataB = await listResB.json();
    const ticketsB = JSON.parse(listDataB.content[0].text);
    expect(ticketsB.length).toBe(0);

    // 5. Get ticket details for Tenant A
    const getResA = await app.request("/mcp/tools/call", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenTenantA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "crm_get_ticket",
        arguments: { ticketId },
      }),
    });
    expect(getResA.status).toBe(200);
    const getDataA = await getResA.json();
    const ticketA = JSON.parse(getDataA.content[0].text);
    expect(ticketA.id).toBe(ticketId);

    // 6. Get ticket details for Tenant B -> returns null under RLS
    const getResB = await app.request("/mcp/tools/call", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenTenantB}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "crm_get_ticket",
        arguments: { ticketId },
      }),
    });
    expect(getResB.status).toBe(200);
    const getDataB = await getResB.json();
    expect(getDataB.content[0].text).toBe("null");

    // 7. Add Comment to ticket via MCP for Tenant A
    const commentResA = await app.request("/mcp/tools/call", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenTenantA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "crm_add_ticket_comment",
        arguments: {
          ticketId,
          body: "Investigating the cluster logs now.",
          authorId: "user-a",
        },
      }),
    });
    expect(commentResA.status).toBe(200);
    const commentDataA = await commentResA.json();
    const comment = JSON.parse(commentDataA.content[0].text);
    expect(comment.id).toBeDefined();
    expect(comment.body).toBe("Investigating the cluster logs now.");

    // 8. Tenant B attempts to comment on Tenant A's ticket -> fails with 404 (Ticket not found due to RLS)
    const commentResB = await app.request("/mcp/tools/call", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenTenantB}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "crm_add_ticket_comment",
        arguments: {
          ticketId,
          body: "Intruder comment",
          authorId: "user-b",
        },
      }),
    });
    expect(commentResB.status).toBe(404);

    // 9. Tenant A applies a canned response macro
    // Scaffold a macro for Tenant A first
    let macroId = "";
    await withTenant(orgA, mockDb, async () => {
      const macro = await dbStore.ticketMacros.insert({
        orgId: orgA,
        name: "Close Database Issues",
        cannedResponse: "Database issue is resolved. Closing this ticket.",
        updateStatus: "Resolved",
        updatePriority: "Low",
        description: "Standard db resolution macro",
      });
      macroId = macro.id;
    });

    const macroResA = await app.request("/mcp/tools/call", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenTenantA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "crm_apply_ticket_macro",
        arguments: {
          ticketId,
          macroId,
        },
      }),
    });
    expect(macroResA.status).toBe(200);
    const macroDataA = await macroResA.json();
    const macroResult = JSON.parse(macroDataA.content[0].text);
    expect(macroResult.success).toBe(true);
    expect(macroResult.ticket.status).toBe("Resolved");
    expect(macroResult.ticket.priority).toBe("Low");

    // 10. Tenant B attempts to apply Tenant A's macro to Tenant A's ticket -> fails with 404
    const macroResB = await app.request("/mcp/tools/call", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenTenantB}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "crm_apply_ticket_macro",
        arguments: {
          ticketId,
          macroId,
        },
      }),
    });
    expect(macroResB.status).toBe(404);
  });
});
