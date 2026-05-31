import { Permission } from "@crm/auth";
import { rollbackStoreMigrations, runStoreMigrations } from "@crm/core";
import { dbStore, store } from "@crm/db";
import { Hono } from "hono";
import { requirePermission } from "../../middleware/rbac";
import { type Env, tenantAuth } from "../../middleware/tenantAuth";

export const dbApp = new Hono<Env>();

dbApp.use("*", tenantAuth, requirePermission(Permission.MANAGE_USERS));

dbApp.get("/migrations", tenantAuth, async (c) => {
  const migrations = await dbStore.schemaMigrations.findMany();
  return c.json({
    success: true,
    migrations,
  });
});

dbApp.post("/migrate", tenantAuth, async (c) => {
  const tenant = c.get("tenant");
  const body = await c.req.json().catch(() => ({}));
  const targetVersion =
    body.targetVersion !== undefined ? Number(body.targetVersion) : undefined;

  const result = await runStoreMigrations(
    dbStore,
    store,
    tenant.orgId,
    targetVersion,
  );

  return c.json(result);
});

dbApp.post("/rollback", tenantAuth, async (c) => {
  const tenant = c.get("tenant");
  const body = await c.req.json().catch(() => ({}));
  if (body.targetVersion === undefined) {
    return c.json(
      { success: false, error: "targetVersion is required for rollback." },
      400,
    );
  }
  const targetVersion = Number(body.targetVersion);

  const result = await rollbackStoreMigrations(
    dbStore,
    store,
    tenant.orgId,
    targetVersion,
  );

  return c.json(result);
});
