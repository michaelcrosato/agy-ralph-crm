import { dbStore } from "@crm/db";
import { defineObject } from "@crm/metadata";
import { Hono } from "hono";
import { resourceRbac } from "../middleware/rbac";
import { type Env, tenantAuth } from "../middleware/tenantAuth";

export const customApp = new Hono<Env>();

// Apply tenantAuth and resourceRbac middleware globally on this router
customApp.use("*", tenantAuth, resourceRbac);

// Helper to find custom entity type by name
async function findCustomType(typeName: string) {
  const allTypes = await dbStore.customEntityTypes.findMany();
  return allTypes.find((t) => t.name.toLowerCase() === typeName.toLowerCase());
}

// POST: Create a record of typeName
customApp.post("/:typeName", async (c) => {
  const typeName = c.req.param("typeName");
  const customType = await findCustomType(typeName);
  if (!customType) {
    return c.json({ error: `Custom object type '${typeName}' not found` }, 404);
  }

  const definition = defineObject({
    name: customType.name,
    fields: customType.fieldsJson,
  });

  const tenant = c.get("tenant");
  const body = await c.req.json().catch(() => ({}));
  const validation = definition.validateRecord(body);
  if (!validation.success) {
    return c.json(
      { error: "Validation failed", errors: validation.errors },
      400,
    );
  }

  const record = await dbStore.customEntityRecords.insert({
    orgId: tenant.orgId,
    typeId: customType.id,
    data: validation.data as Record<string, unknown>,
  });

  return c.json({ success: true, data: record });
});

// GET: List all records of typeName
customApp.get("/:typeName", async (c) => {
  const typeName = c.req.param("typeName");
  const customType = await findCustomType(typeName);
  if (!customType) {
    return c.json({ error: `Custom object type '${typeName}' not found` }, 404);
  }

  const allRecords = await dbStore.customEntityRecords.findMany();
  const records = allRecords.filter((r) => r.typeId === customType.id);

  return c.json({ success: true, data: records });
});

// GET: Retrieve a single record of typeName by id
customApp.get("/:typeName/:id", async (c) => {
  const typeName = c.req.param("typeName");
  const id = c.req.param("id");
  const customType = await findCustomType(typeName);
  if (!customType) {
    return c.json({ error: `Custom object type '${typeName}' not found` }, 404);
  }

  const record = await dbStore.customEntityRecords.findOne(id);
  if (!record || record.typeId !== customType.id) {
    return c.json({ error: "Record not found" }, 404);
  }

  return c.json({ success: true, data: record });
});

// PATCH: Update a record of typeName by id
customApp.patch("/:typeName/:id", async (c) => {
  const typeName = c.req.param("typeName");
  const id = c.req.param("id");
  const customType = await findCustomType(typeName);
  if (!customType) {
    return c.json({ error: `Custom object type '${typeName}' not found` }, 404);
  }

  const record = await dbStore.customEntityRecords.findOne(id);
  if (!record || record.typeId !== customType.id) {
    return c.json({ error: "Record not found" }, 404);
  }

  const definition = defineObject({
    name: customType.name,
    fields: customType.fieldsJson,
  });

  const body = await c.req.json().catch(() => ({}));
  const existingData = record.data || {};
  const mergedData = { ...existingData, ...body };

  const validation = definition.validateRecord(mergedData);
  if (!validation.success) {
    return c.json(
      { error: "Validation failed", errors: validation.errors },
      400,
    );
  }

  const updated = await dbStore.customEntityRecords.update(id, {
    data: validation.data as Record<string, unknown>,
  });

  return c.json({ success: true, data: updated });
});

// DELETE: Delete a record of typeName by id
customApp.delete("/:typeName/:id", async (c) => {
  const typeName = c.req.param("typeName");
  const id = c.req.param("id");
  const customType = await findCustomType(typeName);
  if (!customType) {
    return c.json({ error: `Custom object type '${typeName}' not found` }, 404);
  }

  const record = await dbStore.customEntityRecords.findOne(id);
  if (!record || record.typeId !== customType.id) {
    return c.json({ error: "Record not found" }, 404);
  }

  await dbStore.customEntityRecords.delete(id);

  return c.json({ success: true });
});
