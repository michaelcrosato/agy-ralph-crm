import {
  calculateCPQPrice,
  generateStraightLineSchedules,
  rollupOpportunityAmount,
  validateOpportunityProductSchedule,
} from "@crm/core";
import { dbStore } from "@crm/db";
import { compileTemplate } from "@crm/documents";
import { Hono } from "hono";
import { triggerOutboundWebhooks } from "../../lib/webhooks";
import { type Env, tenantAuth } from "../../middleware/tenantAuth";

export const productsApp = new Hono<Env>();
export const opportunitiesProductsApp = new Hono<Env>();

// ── productsApp Endpoints ──────────────────────────────────────────

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

// ── opportunitiesProductsApp Endpoints (mounted under opportunitiesApp) ──

opportunitiesProductsApp.post("/:oppId/products", tenantAuth, async (c) => {
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

opportunitiesProductsApp.get("/:oppId/products", tenantAuth, async (c) => {
  const oppId = c.req.param("oppId");

  const opportunity = await dbStore.opportunities.findOne(oppId);
  if (!opportunity) {
    return c.json({ error: "Opportunity not found" }, 404);
  }

  const allLines = await dbStore.opportunityProducts.findMany();
  const oppLines = allLines.filter((x) => x.opportunityId === oppId);

  return c.json({ success: true, data: oppLines });
});

opportunitiesProductsApp.patch(
  "/:oppId/products/:lineItemId",
  tenantAuth,
  async (c) => {
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
    const totalPrice = String(
      finalQuantity * Number.parseFloat(finalUnitPrice),
    );

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
  },
);

opportunitiesProductsApp.delete(
  "/:oppId/products/:lineItemId",
  tenantAuth,
  async (c) => {
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
  },
);

opportunitiesProductsApp.post("/:oppId/quote", tenantAuth, async (c) => {
  const tenant = c.get("tenant");
  const oppId = c.req.param("oppId");
  const body = await c.req.json().catch(() => ({}));
  const { templateId, customDiscountPercentage } = body;

  const opportunity = await dbStore.opportunities.findOne(oppId);
  if (!opportunity) {
    return c.json({ error: "Opportunity not found" }, 404);
  }

  let accountName = "N/A";
  if (opportunity.accountId) {
    const account = await dbStore.accounts.findOne(opportunity.accountId);
    if (account) {
      accountName = account.name;
    }
  }

  const allLines = await dbStore.opportunityProducts.findMany();
  const oppLines = allLines.filter((x) => x.opportunityId === oppId);

  let totalQuoteValue = 0;
  const lineItemRows: string[] = [];

  for (const line of oppLines) {
    let productName = "Unknown Product";
    const entry = await dbStore.pricebookEntries.findOne(line.pricebookEntryId);
    if (entry) {
      const product = await dbStore.products.findOne(entry.productId);
      if (product) {
        productName = product.name;
      }
    }

    const calc = calculateCPQPrice({
      unitPrice: line.unitPrice,
      quantity: line.quantity,
      customDiscountPercentage,
    });

    const sub = Number.parseFloat(calc.subtotal) || 1;
    const discountPct =
      ((sub - (Number.parseFloat(calc.totalPrice) || 0)) / sub) * 100;

    lineItemRows.push(
      `<tr>
        <td style="padding: 8px; border: 1px solid #ddd;">${productName}</td>
        <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${line.quantity}</td>
        <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">$${Number.parseFloat(line.unitPrice).toFixed(2)}</td>
        <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">${discountPct.toFixed(0)}% (-$${Number.parseFloat(calc.discountAmount).toFixed(2)})</td>
        <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">$${Number.parseFloat(calc.totalPrice).toFixed(2)}</td>
      </tr>`,
    );

    totalQuoteValue += Number.parseFloat(calc.totalPrice) || 0;
  }

  const lineItemsTable = `
    <table style="width: 100%; border-collapse: collapse; margin-top: 15px;">
      <thead>
        <tr style="background-color: #f2f2f2;">
          <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Product</th>
          <th style="padding: 8px; border: 1px solid #ddd; text-align: center;">Qty</th>
          <th style="padding: 8px; border: 1px solid #ddd; text-align: right;">Unit Price</th>
          <th style="padding: 8px; border: 1px solid #ddd; text-align: right;">Discount</th>
          <th style="padding: 8px; border: 1px solid #ddd; text-align: right;">Total</th>
        </tr>
      </thead>
      <tbody>
        ${lineItemRows.length > 0 ? lineItemRows.join("\n") : '<tr><td colspan="5" style="padding: 8px; border: 1px solid #ddd; text-align: center;">No products configured</td></tr>'}
      </tbody>
    </table>
  `;

  const updatedOppAmount = totalQuoteValue.toFixed(2);
  await dbStore.opportunities.update(oppId, { amount: updatedOppAmount });

  let templateContent = "";
  let matchedTemplateId = templateId;

  if (templateId) {
    const template = await dbStore.documentTemplates.findOne(templateId);
    if (!template) {
      return c.json({ error: "Document template not found" }, 404);
    }
    templateContent = template.content;
  } else {
    const templates = await dbStore.documentTemplates.findMany();
    const standardQuoteTemplate = templates.find(
      (t) => t.name === "Standard Quote Template",
    );

    if (standardQuoteTemplate) {
      templateContent = standardQuoteTemplate.content;
      matchedTemplateId = standardQuoteTemplate.id;
    } else {
      const newTemplate = await dbStore.documentTemplates.insert({
        orgId: tenant.orgId,
        name: "Standard Quote Template",
        content: `
          <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
            <h2 style="color: #0066cc; border-bottom: 2px solid #0066cc; padding-bottom: 10px;">PROPOSAL & QUOTE</h2>
            <div style="margin-top: 15px; margin-bottom: 15px;">
              <p><strong>Prepared For:</strong> {{Account.name}}</p>
              <p><strong>Opportunity Name:</strong> {{Opportunity.name}}</p>
              <p><strong>Date:</strong> {{Date}}</p>
            </div>
            {{LineItemsTable}}
            <div style="margin-top: 20px; text-align: right; font-size: 1.2em;">
              <strong>Total Proposed Value:</strong> \${{Opportunity.amount}}
            </div>
          </div>
        `.trim(),
      });
      templateContent = newTemplate.content;
      matchedTemplateId = newTemplate.id;
    }
  }

  const context: Record<string, unknown> = {
    Account: { name: accountName },
    Opportunity: {
      name: opportunity.name,
      amount: updatedOppAmount,
    },
    Date: new Date().toISOString().substring(0, 10),
    LineItemsTable: lineItemsTable,
  };

  const compiledContent = compileTemplate(templateContent, context);

  const mergedDoc = await dbStore.mergedDocuments.insert({
    orgId: tenant.orgId,
    templateId: matchedTemplateId,
    recordType: "Opportunity",
    recordId: oppId,
    compiledContent,
  });

  await dbStore.auditLogs.insert({
    orgId: tenant.orgId,
    recordId: oppId,
    recordType: "Opportunity",
    action: "generate_quote",
    userId: tenant.userId,
    changes: {
      quoteId: { before: null, after: mergedDoc.id },
      amount: { before: opportunity.amount, after: updatedOppAmount },
    },
  });

  return c.json({
    success: true,
    data: {
      mergedDocumentId: mergedDoc.id,
      compiledContent,
      subtotal: oppLines
        .reduce(
          (acc, l) => acc + l.quantity * Number.parseFloat(l.unitPrice),
          0,
        )
        .toFixed(2),
      discountAmount: oppLines
        .reduce((acc, l) => {
          const calc = calculateCPQPrice({
            unitPrice: l.unitPrice,
            quantity: l.quantity,
            customDiscountPercentage,
          });
          return acc + Number.parseFloat(calc.discountAmount);
        }, 0)
        .toFixed(2),
      totalPrice: updatedOppAmount,
    },
  });
});

opportunitiesProductsApp.get("/:oppId/quote", tenantAuth, async (c) => {
  const oppId = c.req.param("oppId");

  const opportunity = await dbStore.opportunities.findOne(oppId);
  if (!opportunity) {
    return c.json({ error: "Opportunity not found" }, 404);
  }

  const allMerged = await dbStore.mergedDocuments.findMany();
  const opportunityQuotes = allMerged.filter(
    (doc) => doc.recordType === "Opportunity" && doc.recordId === oppId,
  );

  if (opportunityQuotes.length === 0) {
    return c.json(
      { error: "No quote generated for this opportunity yet." },
      404,
    );
  }

  opportunityQuotes.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  return c.json({
    success: true,
    data: opportunityQuotes[0],
  });
});

opportunitiesProductsApp.get(
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

opportunitiesProductsApp.post(
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

opportunitiesProductsApp.delete(
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

opportunitiesProductsApp.post(
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
