import { dbStore } from "@crm/db";
import { createMcpServer, InMemoryTransport } from "@crm/mcp";
import { Hono } from "hono";
import { triggerOutboundWebhooks } from "../lib/webhooks";
import { type Env, tenantAuth } from "../middleware/tenantAuth";

/** Model Context Protocol surface. List tools + execute calls. */
export const mcpApp = new Hono<Env>();

mcpApp.get("/tools", async (c) => {
  const server = createMcpServer({
    tenantContext: { orgId: "system" },
    dbStore,
  });

  const transport = new InMemoryTransport();
  await server.connect(transport);

  const response = await transport.sendRequest({
    id: 1,
    method: "tools/list",
  });

  if ("error" in response) {
    return c.json({ error: response.error.message }, 500);
  }

  return c.json(response.result);
});

mcpApp.post("/tools/call", tenantAuth, async (c) => {
  const tenant = c.get("tenant");
  const body = await c.req.json().catch(() => ({}));
  const { name, arguments: args } = body;

  if (!name) {
    return c.json({ error: "Missing tool name parameter" }, 400);
  }

  const server = createMcpServer({
    tenantContext: { orgId: tenant.orgId, userId: tenant.userId },
    dbStore,
    onActivityTriggered: async (orgId, event, payload) => {
      await triggerOutboundWebhooks(orgId, event, payload);
    },
  });

  const transport = new InMemoryTransport();
  await server.connect(transport);

  try {
    const response = await transport.sendRequest({
      id: 1,
      method: "tools/call",
      params: {
        name,
        arguments: args,
      },
    });

    if ("error" in response) {
      const message = response.error.message || "";
      const status = message.toLowerCase().includes("not found") ? 404 : 400;
      return c.json({ error: message }, status as any);
    }

    return c.json(response.result);
  } catch (error: any) {
    const message = error.message || "";
    const status = message.toLowerCase().includes("not found") ? 404 : 400;
    return c.json({ error: message }, status as any);
  }
});
