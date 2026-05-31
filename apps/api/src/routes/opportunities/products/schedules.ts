import {
  generateStraightLineSchedules,
  validateOpportunityProductSchedule,
} from "@crm/core";
import { dbStore } from "@crm/db";
import { Hono } from "hono";
import { triggerOutboundWebhooks } from "../../../lib/webhooks";
import { type Env, tenantAuth } from "../../../middleware/tenantAuth";

export const schedulesApp = new Hono<Env>();

schedulesApp.get(
  "/:id/products/:productId/schedules",
  tenantAuth,
  async (c) => {
    const id = c.req.param("id");
    const productId = c.req.param("productId");

    const opportunity = await dbStore.opportunities.findOne(id);
    if (!opportunity) {
      return c.json({ error: "Opportunity not found" }, 404);
    }

    const oppProd = await dbStore.opportunityProducts.findOne(productId);
    if (!oppProd || oppProd.opportunityId !== id) {
      return c.json({ error: "Opportunity Product line item not found" }, 404);
    }

    const schedules =
      await dbStore.opportunityProductSchedules.findForProduct(productId);
    return c.json({ success: true, data: schedules });
  },
);

schedulesApp.post(
  "/:id/products/:productId/schedules",
  tenantAuth,
  async (c) => {
    const tenant = c.get("tenant");
    const id = c.req.param("id");
    const productId = c.req.param("productId");

    const opportunity = await dbStore.opportunities.findOne(id);
    if (!opportunity) {
      return c.json({ error: "Opportunity not found" }, 404);
    }

    const oppProd = await dbStore.opportunityProducts.findOne(productId);
    if (!oppProd || oppProd.opportunityId !== id) {
      return c.json({ error: "Opportunity Product line item not found" }, 404);
    }

    const body = await c.req.json().catch(() => ({}));
    const scheduleType = body.scheduleType || "revenue";
    const scheduleDate = new Date(body.scheduleDate);
    const amount = body.amount;
    const description = body.description || null;

    const validation = validateOpportunityProductSchedule(
      productId,
      scheduleType,
      scheduleDate,
      amount,
    );
    if (!validation.success) {
      return c.json({ error: validation.error }, 400);
    }

    const newSchedule = await dbStore.opportunityProductSchedules.insert({
      orgId: tenant.orgId,
      opportunityProductId: productId,
      scheduleType,
      scheduleDate,
      amount,
      description,
    });

    await dbStore.auditLogs.insert({
      orgId: tenant.orgId,
      recordId: newSchedule.id,
      recordType: "opportunity_product_schedules",
      action: "create",
      userId: tenant.userId,
      changes: { schedule: { before: null, after: newSchedule } },
    });

    await triggerOutboundWebhooks(
      tenant.orgId,
      "opportunity_product_schedule.created",
      {
        scheduleId: newSchedule.id,
        opportunityProductId: productId,
        scheduleType,
      },
    );

    return c.json({ success: true, data: newSchedule }, 201);
  },
);

schedulesApp.delete(
  "/:id/products/:productId/schedules/:scheduleId",
  tenantAuth,
  async (c) => {
    const tenant = c.get("tenant");
    const id = c.req.param("id");
    const productId = c.req.param("productId");
    const scheduleId = c.req.param("scheduleId");

    const opportunity = await dbStore.opportunities.findOne(id);
    if (!opportunity) {
      return c.json({ error: "Opportunity not found" }, 404);
    }

    const oppProd = await dbStore.opportunityProducts.findOne(productId);
    if (!oppProd || oppProd.opportunityId !== id) {
      return c.json({ error: "Opportunity Product line item not found" }, 404);
    }

    const schedule =
      await dbStore.opportunityProductSchedules.findOne(scheduleId);
    if (!schedule || schedule.opportunityProductId !== productId) {
      return c.json(
        { error: "Schedule not found on this product line item" },
        404,
      );
    }

    const deleted =
      await dbStore.opportunityProductSchedules.delete(scheduleId);

    await dbStore.auditLogs.insert({
      orgId: tenant.orgId,
      recordId: scheduleId,
      recordType: "opportunity_product_schedules",
      action: "delete",
      userId: tenant.userId,
      changes: { schedule: { before: schedule, after: null } },
    });

    await triggerOutboundWebhooks(
      tenant.orgId,
      "opportunity_product_schedule.deleted",
      {
        scheduleId,
        opportunityProductId: productId,
      },
    );

    return c.json({ success: deleted });
  },
);

schedulesApp.post(
  "/:id/products/:productId/schedules/generate",
  tenantAuth,
  async (c) => {
    const tenant = c.get("tenant");
    const id = c.req.param("id");
    const productId = c.req.param("productId");

    const opportunity = await dbStore.opportunities.findOne(id);
    if (!opportunity) {
      return c.json({ error: "Opportunity not found" }, 404);
    }

    const oppProd = await dbStore.opportunityProducts.findOne(productId);
    if (!oppProd || oppProd.opportunityId !== id) {
      return c.json({ error: "Opportunity Product line item not found" }, 404);
    }

    const body = await c.req.json().catch(() => ({}));
    const periodsCount = Number.parseInt(body.periodsCount, 10) || 12;
    const startDate = new Date(body.startDate || new Date());
    const scheduleType = body.scheduleType || "revenue";

    if (periodsCount <= 0 || periodsCount > 60) {
      return c.json({ error: "Periods count must be between 1 and 60." }, 400);
    }
    if (Number.isNaN(startDate.getTime())) {
      return c.json({ error: "Invalid start date format." }, 400);
    }

    // Determine target total value to straight-line
    const targetTotal =
      scheduleType === "quantity"
        ? String(oppProd.quantity)
        : oppProd.totalPrice;

    // Generate schedules
    const generated = generateStraightLineSchedules(
      productId,
      targetTotal,
      periodsCount,
      startDate,
      scheduleType,
    );

    // RLS-aware replace
    await dbStore.opportunityProductSchedules.deleteForProduct(productId);

    const inserted: unknown[] = [];
    for (const s of generated) {
      const ins = await dbStore.opportunityProductSchedules.insert({
        orgId: tenant.orgId,
        opportunityProductId: s.opportunityProductId,
        scheduleType: s.scheduleType,
        scheduleDate: s.scheduleDate,
        amount: s.amount,
        description: s.description,
      });
      inserted.push(ins);
    }

    await dbStore.auditLogs.insert({
      orgId: tenant.orgId,
      recordId: productId,
      recordType: "opportunity_products",
      action: "schedules_generated",
      userId: tenant.userId,
      changes: { generatedCount: { before: 0, after: inserted.length } },
    });

    await triggerOutboundWebhooks(
      tenant.orgId,
      "opportunity_product_schedule.generated",
      {
        opportunityProductId: productId,
        count: inserted.length,
      },
    );

    return c.json(
      { success: true, count: inserted.length, data: inserted },
      201,
    );
  },
);
