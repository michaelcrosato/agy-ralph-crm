import { dbStore } from "@crm/db";
import { Hono } from "hono";
import { type Env, tenantAuth } from "../middleware/tenantAuth";

/** Lead conversion field mapping rules. */
export const leadConversionsApp = new Hono<Env>();

leadConversionsApp.get("/mappings", tenantAuth, async (c) => {
  const mappings = await dbStore.leadConversionMappings.findMany();
  return c.json({ success: true, data: mappings });
});

leadConversionsApp.post("/mappings", tenantAuth, async (c) => {
  const tenant = c.get("tenant");
  const body = await c.req.json().catch(() => ({}));
  const { sourceLeadField, targetObjectType, targetField } = body;

  if (!sourceLeadField || !targetObjectType || !targetField) {
    return c.json({ error: "Missing required mapping parameters" }, 400);
  }

  if (!["accounts", "contacts", "opportunities"].includes(targetObjectType)) {
    return c.json({ error: "Invalid targetObjectType" }, 400);
  }

  const mapping = await dbStore.leadConversionMappings.insert({
    orgId: tenant.orgId,
    sourceLeadField,
    targetObjectType,
    targetField,
  });

  await dbStore.auditLogs.insert({
    orgId: tenant.orgId,
    recordId: mapping.id,
    recordType: "lead_conversion_mappings",
    action: "create",
    userId: tenant.userId,
    changes: null,
  });

  return c.json({ success: true, data: mapping }, 201);
});

leadConversionsApp.delete("/mappings/:id", tenantAuth, async (c) => {
  const tenant = c.get("tenant");
  const id = c.req.param("id");

  const mapping = await dbStore.leadConversionMappings.findOne(id);
  if (!mapping) {
    return c.json({ error: "Mapping not found" }, 404);
  }

  await dbStore.leadConversionMappings.delete(id);

  await dbStore.auditLogs.insert({
    orgId: tenant.orgId,
    recordId: id,
    recordType: "lead_conversion_mappings",
    action: "delete",
    userId: tenant.userId,
    changes: null,
  });

  return c.json({ success: true });
});
