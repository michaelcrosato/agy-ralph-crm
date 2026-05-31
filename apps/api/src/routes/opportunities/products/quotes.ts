import { calculateCPQPrice } from "@crm/core";
import { dbStore } from "@crm/db";
import { compileTemplate } from "@crm/documents";
import { Hono } from "hono";
import { type Env, tenantAuth } from "../../../middleware/tenantAuth";

export const quotesApp = new Hono<Env>();

quotesApp.post("/:oppId/quote", tenantAuth, async (c) => {
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

quotesApp.get("/:oppId/quote", tenantAuth, async (c) => {
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
