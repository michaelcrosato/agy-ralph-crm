import { dbStore } from "@crm/db";
import { Hono } from "hono";
import { type Env, tenantAuth } from "../../../middleware/tenantAuth";

export const productsApp = new Hono<Env>();

productsApp.post("/", tenantAuth, async (c) => {
  const tenant = c.get("tenant");
  const body = await c.req.json().catch(() => ({}));
  const { name, sku, description, isActive } = body;

  if (!name) {
    return c.json({ error: "Missing required product name" }, 400);
  }

  const product = await dbStore.products.insert({
    orgId: tenant.orgId,
    name,
    sku: sku || null,
    description: description || null,
    isActive: isActive !== undefined ? !!isActive : true,
  });

  return c.json({ success: true, data: product });
});

productsApp.get("/", tenantAuth, async (c) => {
  const products = await dbStore.products.findMany();
  return c.json({ success: true, data: products });
});
