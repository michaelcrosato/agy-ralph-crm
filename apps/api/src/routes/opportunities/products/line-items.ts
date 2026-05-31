import { rollupOpportunityAmount } from "@crm/core";
import { dbStore } from "@crm/db";
import { Hono } from "hono";
import { type Env, tenantAuth } from "../../../middleware/tenantAuth";

export const lineItemsApp = new Hono<Env>();

lineItemsApp.post("/:oppId/products", tenantAuth, async (c) => {
  const tenant = c.get("tenant");
  const oppId = c.req.param("oppId");
  const body = await c.req.json().catch(() => ({}));
  const { pricebookEntryId, quantity, unitPrice } = body;

  if (!pricebookEntryId || quantity === undefined) {
    return c.json({ error: "Missing required line item parameters" }, 400);
  }

  const opportunity = await dbStore.opportunities.findOne(oppId);
  if (!opportunity) {
    return c.json({ error: "Opportunity not found" }, 404);
  }

  const entry = await dbStore.pricebookEntries.findOne(pricebookEntryId);
  if (!entry) {
    return c.json({ error: "Pricebook entry not found" }, 404);
  }

  const finalUnitPrice =
    unitPrice !== undefined ? String(unitPrice) : entry.unitPrice;
  const finalQuantity = Number(quantity);
  const totalPrice = String(finalQuantity * Number.parseFloat(finalUnitPrice));

  const lineItem = await dbStore.opportunityProducts.insert({
    orgId: tenant.orgId,
    opportunityId: oppId,
    pricebookEntryId,
    quantity: finalQuantity,
    unitPrice: finalUnitPrice,
    totalPrice,
  });

  // Calculate Rollup
  const allLines = await dbStore.opportunityProducts.findMany();
  const oppLines = allLines.filter((x) => x.opportunityId === oppId);
  const newAmount = rollupOpportunityAmount(oppLines);

  await dbStore.opportunities.update(oppId, { amount: newAmount });

  return c.json({
    success: true,
    data: lineItem,
    opportunityAmount: newAmount,
  });
});

lineItemsApp.get("/:oppId/products", tenantAuth, async (c) => {
  const oppId = c.req.param("oppId");

  const opportunity = await dbStore.opportunities.findOne(oppId);
  if (!opportunity) {
    return c.json({ error: "Opportunity not found" }, 404);
  }

  const allLines = await dbStore.opportunityProducts.findMany();
  const oppLines = allLines.filter((x) => x.opportunityId === oppId);

  return c.json({ success: true, data: oppLines });
});

lineItemsApp.patch("/:oppId/products/:lineItemId", tenantAuth, async (c) => {
  const oppId = c.req.param("oppId");
  const lineItemId = c.req.param("lineItemId");
  const body = await c.req.json().catch(() => ({}));
  const { quantity, unitPrice } = body;

  const opportunity = await dbStore.opportunities.findOne(oppId);
  if (!opportunity) {
    return c.json({ error: "Opportunity not found" }, 404);
  }

  const existingLine = await dbStore.opportunityProducts.findOne(lineItemId);
  if (!existingLine || existingLine.opportunityId !== oppId) {
    return c.json({ error: "Opportunity product not found" }, 404);
  }

  const finalQuantity =
    quantity !== undefined ? Number(quantity) : existingLine.quantity;
  const finalUnitPrice =
    unitPrice !== undefined ? String(unitPrice) : existingLine.unitPrice;
  const totalPrice = String(finalQuantity * Number.parseFloat(finalUnitPrice));

  const updatedLine = await dbStore.opportunityProducts.update(lineItemId, {
    quantity: finalQuantity,
    unitPrice: finalUnitPrice,
    totalPrice,
  });

  // Recalculate Rollup
  const allLines = await dbStore.opportunityProducts.findMany();
  const oppLines = allLines.filter((x) => x.opportunityId === oppId);
  const newAmount = rollupOpportunityAmount(oppLines);

  await dbStore.opportunities.update(oppId, { amount: newAmount });

  return c.json({
    success: true,
    data: updatedLine,
    opportunityAmount: newAmount,
  });
});

lineItemsApp.delete("/:oppId/products/:lineItemId", tenantAuth, async (c) => {
  const oppId = c.req.param("oppId");
  const lineItemId = c.req.param("lineItemId");

  const opportunity = await dbStore.opportunities.findOne(oppId);
  if (!opportunity) {
    return c.json({ error: "Opportunity not found" }, 404);
  }

  const existingLine = await dbStore.opportunityProducts.findOne(lineItemId);
  if (!existingLine || existingLine.opportunityId !== oppId) {
    return c.json({ error: "Opportunity product not found" }, 404);
  }

  await dbStore.opportunityProducts.delete(lineItemId);

  // Recalculate Rollup
  const allLines = await dbStore.opportunityProducts.findMany();
  const oppLines = allLines.filter((x) => x.opportunityId === oppId);
  const newAmount = rollupOpportunityAmount(oppLines);

  await dbStore.opportunities.update(oppId, { amount: newAmount });

  return c.json({ success: true, opportunityAmount: newAmount });
});
