import { rollupHierarchyPipeline } from "@crm/core";
import { dbStore } from "@crm/db";
import { OpenAPIHono } from "@hono/zod-openapi";
import { type Env, tenantAuth } from "../../middleware/tenantAuth";

export const hierarchyApp = new OpenAPIHono<Env>();

hierarchyApp.get("/:id/hierarchy", tenantAuth, async (c) => {
  const id = c.req.param("id");
  const account = await dbStore.accounts.findOne(id);
  if (!account) {
    return c.json({ error: "Account not found" }, 404);
  }

  const parentPath = await dbStore.accounts.findParentPath(id);
  const children = await dbStore.accounts.findChildren(id);

  return c.json({
    success: true,
    data: {
      parentPath,
      children,
    },
  });
});

hierarchyApp.get("/:id/consolidated-pipeline", tenantAuth, async (c) => {
  const id = c.req.param("id");
  const account = await dbStore.accounts.findOne(id);
  if (!account) {
    return c.json({ error: "Account not found" }, 404);
  }

  const allAccounts = await dbStore.accounts.findMany();
  const allOpps = await dbStore.opportunities.findMany();

  const rollup = rollupHierarchyPipeline(allAccounts, allOpps, id);

  return c.json({
    success: true,
    data: rollup,
  });
});
