import { calculateProRatedAmount, generateRenewalOpportunity } from "@crm/core";
import { dbStore } from "@crm/db";
import { compileTemplate } from "@crm/documents";
import { Hono } from "hono";
import { triggerOutboundWebhooks } from "../lib/webhooks";
import { type Env, tenantAuth } from "../middleware/tenantAuth";

export const contractsApp = new Hono<Env>();
export const documentsApp = new Hono<Env>();
export const invoicesApp = new Hono<Env>();
export const subscriptionsApp = new Hono<Env>();
contractsApp.post("/", tenantAuth, async (c) => {
  const tenant = c.get("tenant");
  const body = await c.req.json().catch(() => ({}));
  const {
    accountId,
    opportunityId,
    contractAmount,
    startDate,
    endDate,
    status,
  } = body;

  if (!accountId || !contractAmount || !startDate || !endDate) {
    return c.json(
      {
        error: "accountId, contractAmount, startDate, and endDate are required",
      },
      400,
    );
  }

  const account = await dbStore.accounts.findOne(accountId);
  if (!account) {
    return c.json({ error: "Account not found" }, 400);
  }

  const newContract = await dbStore.contracts.insert({
    orgId: tenant.orgId,
    accountId,
    opportunityId: opportunityId || null,
    contractAmount: String(contractAmount),
    startDate: new Date(startDate),
    endDate: new Date(endDate),
    status: status || "Draft",
  });

  await dbStore.auditLogs.insert({
    orgId: tenant.orgId,
    recordId: newContract.id,
    recordType: "contracts",
    action: "create",
    userId: tenant.userId,
    changes: {
      contract: { before: null, after: newContract },
    },
  });

  await triggerOutboundWebhooks(
    tenant.orgId,
    "contract.created",
    newContract as unknown as Record<string, unknown>,
  );

  return c.json({ success: true, data: newContract }, 201);
});

contractsApp.patch("/:id", tenantAuth, async (c) => {
  const tenant = c.get("tenant");
  const id = c.req.param("id");

  const currentContract = await dbStore.contracts.findOne(id);
  if (!currentContract) {
    return c.json({ error: "Contract not found" }, 404);
  }

  const body = await c.req.json().catch(() => ({}));
  const updates: Partial<
    Omit<typeof currentContract, "id" | "orgId" | "createdAt">
  > = {};

  if (body.contractAmount !== undefined)
    updates.contractAmount = String(body.contractAmount);
  if (body.startDate !== undefined)
    updates.startDate = new Date(body.startDate);
  if (body.endDate !== undefined) updates.endDate = new Date(body.endDate);
  if (body.status !== undefined) updates.status = body.status;
  if (body.opportunityId !== undefined)
    updates.opportunityId = body.opportunityId;

  const updatedContract = await dbStore.contracts.update(id, updates);

  await dbStore.auditLogs.insert({
    orgId: tenant.orgId,
    recordId: id,
    recordType: "contracts",
    action: "update",
    userId: tenant.userId,
    changes: {
      contract: { before: currentContract, after: updatedContract },
    },
  });

  await triggerOutboundWebhooks(
    tenant.orgId,
    "contract.updated",
    updatedContract as unknown as Record<string, unknown>,
  );

  return c.json({ success: true, data: updatedContract });
});

contractsApp.delete("/:id", tenantAuth, async (c) => {
  const tenant = c.get("tenant");
  const id = c.req.param("id");

  const currentContract = await dbStore.contracts.findOne(id);
  if (!currentContract) {
    return c.json({ error: "Contract not found" }, 404);
  }

  await dbStore.contracts.delete(id);

  await dbStore.auditLogs.insert({
    orgId: tenant.orgId,
    recordId: id,
    recordType: "contracts",
    action: "delete",
    userId: tenant.userId,
    changes: {
      contract: { before: currentContract, after: null },
    },
  });

  await triggerOutboundWebhooks(tenant.orgId, "contract.deleted", {
    orgId: tenant.orgId,
    id,
    accountId: currentContract.accountId,
  });

  return c.json({ success: true });
});

contractsApp.post("/:id/renew", tenantAuth, async (c) => {
  const tenant = c.get("tenant");
  const id = c.req.param("id");

  const contract = await dbStore.contracts.findOne(id);
  if (!contract) {
    return c.json({ error: "Contract not found" }, 404);
  }

  if (contract.status !== "Active") {
    return c.json({ error: "Contract must be Active to renew" }, 400);
  }

  const account = await dbStore.accounts.findOne(contract.accountId);
  if (!account) {
    return c.json({ error: "Account associated with contract not found" }, 400);
  }

  const body = await c.req.json().catch(() => ({}));
  const escalationPct =
    body.escalationPercentage !== undefined
      ? Number(body.escalationPercentage)
      : 5;

  const generatedOpp = generateRenewalOpportunity({
    contract: {
      ...contract,
      contractAmount: contract.contractAmount,
    },
    accountName: account.name,
    escalationPercentage: escalationPct,
  });

  // Create the new renewal opportunity
  const newOpportunity = await dbStore.opportunities.insert({
    orgId: tenant.orgId,
    ownerId: account.ownerId,
    accountId: contract.accountId,
    name: generatedOpp.name,
    stage: generatedOpp.stage,
    amount: generatedOpp.amount,
    closeDate: generatedOpp.closeDate,
    custom: null,
  });

  // Transition contract to "Renewed" and associate the new opportunity
  const updatedContract = await dbStore.contracts.update(id, {
    status: "Renewed",
    opportunityId: newOpportunity.id,
  });

  await dbStore.auditLogs.insert({
    orgId: tenant.orgId,
    recordId: id,
    recordType: "contracts",
    action: "renew",
    userId: tenant.userId,
    changes: {
      contract: { before: contract, after: updatedContract },
      opportunity: { before: null, after: newOpportunity },
    },
  });

  await triggerOutboundWebhooks(tenant.orgId, "contract.renewed", {
    contract: updatedContract,
    opportunity: newOpportunity,
  });

  return c.json({ success: true, data: newOpportunity }, 201);
});
documentsApp.post("/templates", tenantAuth, async (c) => {
  const tenant = c.get("tenant");
  const body = await c.req.json().catch(() => ({}));
  const { name, content } = body;

  if (!name || !content) {
    return c.json({ error: "Missing required document template fields" }, 400);
  }

  const template = await dbStore.documentTemplates.insert({
    orgId: tenant.orgId,
    name,
    content,
  });

  return c.json({ success: true, data: template });
});

documentsApp.get("/templates", tenantAuth, async (c) => {
  const templates = await dbStore.documentTemplates.findMany();
  return c.json({ success: true, data: templates });
});

documentsApp.post("/merge", tenantAuth, async (c) => {
  const tenant = c.get("tenant");
  const body = await c.req.json().catch(() => ({}));
  const { templateId, recordType, recordId } = body;

  if (!templateId || !recordType || !recordId) {
    return c.json({ error: "Missing required merge parameters" }, 400);
  }

  const template = await dbStore.documentTemplates.findOne(templateId);
  if (!template) {
    return c.json({ error: "Document template not found" }, 404);
  }

  let record: Record<string, unknown> | null = null;
  if (recordType === "Lead") {
    const lead = await dbStore.leads.findOne(recordId);
    if (lead) {
      const emailParts = lead.email
        ? lead.email.split("@")[0].split(".")
        : ["Unknown"];
      const firstName = emailParts[0] || "Unknown";
      const lastName = emailParts[1] || "Contact";
      record = {
        ...(lead as unknown as Record<string, unknown>),
        firstName,
        lastName,
      };
    }
  } else if (recordType === "Account") {
    record = (await dbStore.accounts.findOne(recordId)) as unknown as Record<
      string,
      unknown
    >;
  } else if (recordType === "Contact") {
    record = (await dbStore.contacts.findOne(recordId)) as unknown as Record<
      string,
      unknown
    >;
  } else if (recordType === "Opportunity") {
    record = (await dbStore.opportunities.findOne(
      recordId,
    )) as unknown as Record<string, unknown>;
  } else if (recordType === "Ticket") {
    record = (await dbStore.tickets.findOne(recordId)) as unknown as Record<
      string,
      unknown
    >;
  }

  if (!record) {
    return c.json(
      { error: `Target record ${recordType} with ID ${recordId} not found` },
      404,
    );
  }

  const compiledContent = compileTemplate(template.content, record);

  const merged = await dbStore.mergedDocuments.insert({
    orgId: tenant.orgId,
    templateId,
    recordType,
    recordId,
    compiledContent,
  });

  return c.json({ success: true, data: merged });
});

documentsApp.get("/merged", tenantAuth, async (c) => {
  const merged = await dbStore.mergedDocuments.findMany();
  return c.json({ success: true, data: merged });
});
invoicesApp.post("/generate", tenantAuth, async (c) => {
  const tenant = c.get("tenant");
  const body = await c.req.json().catch(() => ({}));
  const { dueDate, daysUsed, daysInPeriod } = body;

  const subs = await dbStore.subscriptions.findMany();
  const activeSubs = subs.filter((s) => s.status === "active");

  const generatedInvoices = [];
  for (const sub of activeSubs) {
    const existingInvoices = await dbStore.invoices.findMany();
    const alreadyInvoiced = existingInvoices.some(
      (inv) =>
        inv.subscriptionId === sub.id &&
        (dueDate
          ? new Date(inv.dueDate).getTime() === new Date(dueDate).getTime()
          : true),
    );
    if (alreadyInvoiced && !body.force) {
      continue;
    }

    let amount = String(Number.parseFloat(sub.unitPrice) * sub.quantity);
    if (daysUsed !== undefined && daysInPeriod !== undefined) {
      amount = calculateProRatedAmount({
        unitPrice: sub.unitPrice,
        quantity: sub.quantity,
        daysUsed,
        daysInPeriod,
      });
    }

    const inv = await dbStore.invoices.insert({
      orgId: tenant.orgId,
      subscriptionId: sub.id,
      accountId: sub.accountId,
      amount,
      dueDate: dueDate ? new Date(dueDate) : new Date(),
      status: "Unpaid",
    });
    generatedInvoices.push(inv);

    await dbStore.auditLogs.insert({
      orgId: tenant.orgId,
      recordId: inv.id,
      recordType: "Invoice",
      action: "create",
      userId: tenant.userId,
      changes: null,
    });

    triggerOutboundWebhooks(
      tenant.orgId,
      "invoice.created",
      inv as unknown as Record<string, unknown>,
    );
  }

  return c.json({ success: true, data: generatedInvoices });
});

invoicesApp.get("/", tenantAuth, async (c) => {
  const invs = await dbStore.invoices.findMany();
  return c.json({ success: true, data: invs });
});
subscriptionsApp.post("/", tenantAuth, async (c) => {
  const tenant = c.get("tenant");
  const body = await c.req.json().catch(() => ({}));
  const {
    accountId,
    planName,
    billingPeriod,
    unitPrice,
    quantity,
    startDate,
    endDate,
  } = body;

  if (!accountId || !planName || !billingPeriod || !unitPrice || !startDate) {
    return c.json({ error: "Missing required subscription parameters" }, 400);
  }

  const sub = await dbStore.subscriptions.insert({
    orgId: tenant.orgId,
    accountId,
    planName,
    status: "active",
    billingPeriod,
    unitPrice: String(unitPrice),
    quantity: quantity !== undefined ? Number(quantity) : 1,
    startDate: new Date(startDate),
    endDate: endDate ? new Date(endDate) : null,
  });

  await dbStore.auditLogs.insert({
    orgId: tenant.orgId,
    recordId: sub.id,
    recordType: "Subscription",
    action: "create",
    userId: tenant.userId,
    changes: null,
  });

  triggerOutboundWebhooks(
    tenant.orgId,
    "subscription.created",
    sub as unknown as Record<string, unknown>,
  );

  return c.json({ success: true, data: sub });
});

subscriptionsApp.get("/", tenantAuth, async (c) => {
  const subs = await dbStore.subscriptions.findMany();
  return c.json({ success: true, data: subs });
});
