import { generateRenewalOpportunity } from "@crm/core";
import { dbStore } from "@crm/db";
import { Hono } from "hono";
import { triggerOutboundWebhooks } from "../../lib/webhooks";
import { type Env, tenantAuth } from "../../middleware/tenantAuth";

export const contractsApp = new Hono<Env>();

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
