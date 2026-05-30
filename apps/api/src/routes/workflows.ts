import { dbStore } from "@crm/db";
import { Hono } from "hono";
import { type Env, tenantAuth } from "../middleware/tenantAuth";

/** Workflow automation rules CRUD. */
export const workflowsApp = new Hono<Env>();

workflowsApp.post("/", tenantAuth, async (c) => {
  const tenant = c.get("tenant");
  const body = await c.req.json().catch(() => ({}));
  const { name, triggerEvent, conditions, actions } = body;

  if (!name || !triggerEvent || !actions) {
    return c.json({ error: "Missing required workflow rules parameters" }, 400);
  }

  const newRule = await dbStore.workflows.insert({
    orgId: tenant.orgId,
    name,
    triggerEvent,
    conditions: conditions || null,
    actions,
  });

  return c.json({ success: true, data: newRule });
});

workflowsApp.get("/", tenantAuth, async (c) => {
  const rules = await dbStore.workflows.findMany();
  return c.json({ success: true, data: rules });
});
