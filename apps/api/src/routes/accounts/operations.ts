import {
  calculateAccountDuplicates,
  evaluateTerritoryRouting,
  mergeAccounts,
} from "@crm/core";
import { dbStore, store } from "@crm/db";
import { OpenAPIHono } from "@hono/zod-openapi";
import { triggerOutboundWebhooks } from "../../lib/webhooks";
import { type Env, tenantAuth } from "../../middleware/tenantAuth";

export const operationsApp = new OpenAPIHono<Env>();

operationsApp.get("/:id/duplicates", tenantAuth, async (c) => {
  const id = c.req.param("id");
  const sourceAccount = await dbStore.accounts.findOne(id);
  if (!sourceAccount) {
    return c.json({ error: "Account not found" }, 404);
  }
  const allAccounts = await dbStore.accounts.findMany();
  const duplicates = calculateAccountDuplicates(sourceAccount, allAccounts);
  return c.json({ success: true, data: duplicates });
});

operationsApp.post("/:id/merge", tenantAuth, async (c) => {
  const tenant = c.get("tenant");
  const id = c.req.param("id");
  const body = await c.req.json().catch(() => ({}));
  const { duplicateId, fieldResolution } = body;

  if (!duplicateId || !fieldResolution) {
    return c.json(
      { error: "Missing duplicateId or fieldResolution parameters" },
      400,
    );
  }

  const master = await dbStore.accounts.findOne(id);
  const duplicate = await dbStore.accounts.findOne(duplicateId);

  if (!master || !duplicate) {
    return c.json({ error: "Master or duplicate account not found" }, 404);
  }

  if (master.orgId !== tenant.orgId || duplicate.orgId !== tenant.orgId) {
    throw new Error("RLS Isolation Violation: Tenant mismatch.");
  }

  const mergedAccount = mergeAccounts({ master, duplicate, fieldResolution });

  const updatedMaster = await dbStore.accounts.update(id, {
    name: mergedAccount.name,
    domain: mergedAccount.domain,
    custom: mergedAccount.custom,
  });

  if (!updatedMaster) {
    return c.json({ error: "Failed to update master account" }, 500);
  }

  for (const contact of store.contacts) {
    if (contact.orgId === tenant.orgId && contact.accountId === duplicateId) {
      contact.accountId = id;
    }
  }

  for (const opp of store.opportunities) {
    if (opp.orgId === tenant.orgId && opp.accountId === duplicateId) {
      opp.accountId = id;
    }
  }

  for (const contract of store.contracts) {
    if (contract.orgId === tenant.orgId && contract.accountId === duplicateId) {
      contract.accountId = id;
    }
  }

  for (const link of store.activityLinks) {
    if (
      link.orgId === tenant.orgId &&
      link.targetType === "Account" &&
      link.targetId === duplicateId
    ) {
      link.targetId = id;
    }
  }

  const duplicateTeamMembers = store.accountTeams.filter(
    (m) => m.orgId === tenant.orgId && m.accountId === duplicateId,
  );

  for (const dupMember of duplicateTeamMembers) {
    const masterAlreadyHasUser = store.accountTeams.some(
      (m) =>
        m.orgId === tenant.orgId &&
        m.accountId === id &&
        m.userId === dupMember.userId,
    );
    if (masterAlreadyHasUser) {
      const idx = store.accountTeams.findIndex((m) => m.id === dupMember.id);
      if (idx !== -1) {
        store.accountTeams.splice(idx, 1);
      }
    } else {
      dupMember.accountId = id;
    }
  }

  await dbStore.accounts.delete(duplicateId);

  await dbStore.auditLogs.insert({
    orgId: tenant.orgId,
    recordId: id,
    recordType: "accounts",
    action: "update",
    userId: tenant.userId,
    changes: {
      merge: { before: duplicateId, after: "merged_into_master" },
    },
  });

  await triggerOutboundWebhooks(tenant.orgId, "account.merged", {
    accountId: id,
    mergedAccountId: duplicateId,
    finalAccount: updatedMaster,
  });

  return c.json({ success: true, data: updatedMaster });
});

operationsApp.post("/:id/route", tenantAuth, async (c) => {
  const tenant = c.get("tenant");
  const id = c.req.param("id");
  const account = await dbStore.accounts.findOne(id);
  if (!account) {
    return c.json({ error: "Account not found" }, 404);
  }

  const territories = await dbStore.territories.findMany();
  const members = await dbStore.territoryMembers.findMany();

  const evalAccount = {
    ...account,
    custom: account.custom || null,
  };

  const matchResult = evaluateTerritoryRouting(
    evalAccount,
    territories,
    members,
  );

  if (!matchResult) {
    return c.json({
      success: false,
      message: "No matching territory routing found.",
    });
  }

  const matchedTerritory = territories.find(
    (t) => t.id === matchResult.matchedTerritoryId,
  );

  const previousOwnerId = account.ownerId;
  let updatedAccount = account;

  if (matchResult.newOwnerId) {
    const existingCustom =
      (account.custom as Record<string, unknown> | null) || {};
    const updatedCustom = {
      ...existingCustom,
      territoryId: matchResult.matchedTerritoryId,
      territoryName: matchedTerritory?.name || "Unknown",
    };

    const updated = await dbStore.accounts.update(id, {
      ownerId: matchResult.newOwnerId,
      custom: updatedCustom,
    });
    if (updated) {
      updatedAccount = updated;
    }
  }

  // Update territory round-robin index if needed
  if (matchedTerritory && matchedTerritory.routingMethod === "round_robin") {
    await dbStore.territories.update(matchedTerritory.id, {
      lastAssignedIndex: matchResult.newLastAssignedIndex,
    });
  }

  // Log audit logs
  await dbStore.auditLogs.insert({
    orgId: tenant.orgId,
    recordId: id,
    recordType: "accounts",
    action: "route",
    userId: tenant.userId,
    changes: {
      ownerId: { before: previousOwnerId, after: matchResult.newOwnerId },
      territoryId: { before: null, after: matchResult.matchedTerritoryId },
    },
  });

  // Trigger Webhook
  await triggerOutboundWebhooks(tenant.orgId, "account.routed", {
    accountId: id,
    territoryId: matchResult.matchedTerritoryId,
    newOwnerId: matchResult.newOwnerId,
  });

  return c.json({
    success: true,
    data: updatedAccount,
    matchInfo: {
      territoryId: matchResult.matchedTerritoryId,
      newOwnerId: matchResult.newOwnerId,
    },
  });
});

operationsApp.get("/:id/contracts", tenantAuth, async (c) => {
  const id = c.req.param("id");
  const account = await dbStore.accounts.findOne(id);
  if (!account) {
    return c.json({ error: "Account not found" }, 404);
  }
  const contracts = await dbStore.contracts.findForAccount(id);
  return c.json({ success: true, data: contracts });
});
