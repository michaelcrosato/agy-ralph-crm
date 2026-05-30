import { dbStore } from "@crm/db";
import { Hono } from "hono";
import { type Env, tenantAuth } from "../../middleware/tenantAuth";

export const pricebooksApp = new Hono<Env>();

pricebooksApp.post("/", tenantAuth, async (c) => {
  const tenant = c.get("tenant");
  const body = await c.req.json().catch(() => ({}));
  const { name, description, isActive, isStandard } = body;

  if (!name) {
    return c.json({ error: "Missing required pricebook name" }, 400);
  }

  const pricebook = await dbStore.pricebooks.insert({
    orgId: tenant.orgId,
    name,
    description: description || null,
    isActive: isActive !== undefined ? !!isActive : true,
    isStandard: isStandard !== undefined ? !!isStandard : false,
  });

  return c.json({ success: true, data: pricebook });
});

pricebooksApp.get("/", tenantAuth, async (c) => {
  const pricebooks = await dbStore.pricebooks.findMany();
  return c.json({ success: true, data: pricebooks });
});

pricebooksApp.post("/entries", tenantAuth, async (c) => {
  const tenant = c.get("tenant");
  const body = await c.req.json().catch(() => ({}));
  const { pricebookId, productId, unitPrice, isActive } = body;

  if (!pricebookId || !productId || unitPrice === undefined) {
    return c.json({ error: "Missing required pricebook entry fields" }, 400);
  }

  const product = await dbStore.products.findOne(productId);
  if (!product) {
    return c.json({ error: "Product not found" }, 404);
  }

  const pricebook = await dbStore.pricebooks.findOne(pricebookId);
  if (!pricebook) {
    return c.json({ error: "Pricebook not found" }, 404);
  }

  const entry = await dbStore.pricebookEntries.insert({
    orgId: tenant.orgId,
    pricebookId,
    productId,
    unitPrice: String(unitPrice),
    isActive: isActive !== undefined ? !!isActive : true,
  });

  return c.json({ success: true, data: entry });
});
