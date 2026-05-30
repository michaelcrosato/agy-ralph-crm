import {
  calculateAccountDuplicates,
  detectCircularAccountRelation,
  evaluateTerritoryRouting,
  mergeAccounts,
  rollupHierarchyPipeline,
  validateAccountTeamMember,
} from "@crm/core";
import { dbStore, store } from "@crm/db";
import { Hono } from "hono";
import {
  enforceCustomValidationRules,
  enforcePicklistDependencies,
} from "../lib/validation";
import { triggerOutboundWebhooks } from "../lib/webhooks";
import { type Env, tenantAuth } from "../middleware/tenantAuth";

/** Account CRUD + hierarchy + duplicates + merge + team. Mounted at /api/accounts. */
export const accountsApp = new Hono<Env>();

accountsApp.get("/", tenantAuth, async (c) => {
  const accounts = await dbStore.accounts.findMany();
  return c.json({ success: true, data: accounts });
});

accountsApp.post("/", tenantAuth, async (c) => {
  const tenant = c.get("tenant");
  const body = await c.req.json().catch(() => ({}));
  const { name, domain, custom, parentAccountId } = body;

  if (!name) {
    return c.json({ error: "Missing required parameter: name" }, 400);
  }

  const pldValidation = await enforcePicklistDependencies("accounts", {
    ...body,
    ...(custom || {}),
  });
  if (!pldValidation.success) {
    return c.json({ error: pldValidation.error }, 400);
  }

  const customValValidation = await enforceCustomValidationRules("accounts", {
    ...body,
    ...(custom || {}),
  });
  if (!customValValidation.success) {
    return c.json({ error: customValValidation.error }, 400);
  }

  if (parentAccountId) {
    const parent = await dbStore.accounts.findOne(parentAccountId);
    if (!parent) {
      return c.json({ error: "Parent account not found" }, 400);
    }
  }

  const account = await dbStore.accounts.insert({
    orgId: tenant.orgId,
    ownerId: tenant.userId,
    name,
    domain: domain || null,
    custom: custom || null,
    parentAccountId: parentAccountId || null,
  });

  await dbStore.auditLogs.insert({
    orgId: tenant.orgId,
    recordId: account.id,
    recordType: "accounts",
    action: "create",
    userId: tenant.userId,
    changes: {
      account: { before: null, after: account },
    },
  });

  return c.json({ success: true, data: account }, 201);
});

accountsApp.get("/:id", tenantAuth, async (c) => {
  const id = c.req.param("id");
  const account = await dbStore.accounts.findOne(id);
  if (!account) {
    return c.json({ error: "Account not found" }, 404);
  }
  return c.json({ success: true, data: account });
});

accountsApp.patch("/:id", tenantAuth, async (c) => {
  const tenant = c.get("tenant");
  const id = c.req.param("id");

  const existing = await dbStore.accounts.findOne(id);
  if (!existing) {
    return c.json({ error: "Account not found" }, 404);
  }

  const body = await c.req.json().catch(() => ({}));

  const combinedForValidation = {
    ...existing,
    ...body,
    custom: {
      ...(existing.custom || {}),
      ...(body.custom || {}),
    },
  };
  const pldValidation = await enforcePicklistDependencies("accounts", {
    ...combinedForValidation,
    ...(combinedForValidation.custom || {}),
  });
  if (!pldValidation.success) {
    return c.json({ error: pldValidation.error }, 400);
  }

  const customValValidation = await enforceCustomValidationRules("accounts", {
    ...combinedForValidation,
    ...(combinedForValidation.custom || {}),
  });
  if (!customValValidation.success) {
    return c.json({ error: customValValidation.error }, 400);
  }

  const updates: Partial<Omit<typeof existing, "id" | "orgId" | "ownerId">> =
    {};

  if (body.name !== undefined) updates.name = body.name;
  if (body.domain !== undefined) updates.domain = body.domain;
  if (body.custom !== undefined) updates.custom = body.custom;

  if (body.parentAccountId !== undefined) {
    const parentId = body.parentAccountId;
    if (parentId !== null) {
      const parent = await dbStore.accounts.findOne(parentId);
      if (!parent) {
        return c.json({ error: "Parent account not found" }, 400);
      }

      const allAccounts = await dbStore.accounts.findMany();
      const hasCycle = detectCircularAccountRelation(allAccounts, id, parentId);
      if (hasCycle) {
        return c.json(
          {
            error: "Setting this parent account creates a circular reference.",
          },
          400,
        );
      }
    }
    updates.parentAccountId = parentId;
  }

  const updated = await dbStore.accounts.update(id, updates);

  if (
    body.parentAccountId !== undefined &&
    existing.parentAccountId !== updates.parentAccountId
  ) {
    await dbStore.auditLogs.insert({
      orgId: tenant.orgId,
      recordId: id,
      recordType: "accounts",
      action: "update_hierarchy",
      userId: tenant.userId,
      changes: {
        parentAccountId: {
          before: existing.parentAccountId,
          after: updates.parentAccountId || null,
        },
      },
    });

    await triggerOutboundWebhooks(tenant.orgId, "account.hierarchy_updated", {
      accountId: id,
      oldParentId: existing.parentAccountId,
      newParentId: updates.parentAccountId || null,
    });
  } else {
    await dbStore.auditLogs.insert({
      orgId: tenant.orgId,
      recordId: id,
      recordType: "accounts",
      action: "update",
      userId: tenant.userId,
      changes: {
        account: { before: existing, after: updated },
      },
    });
  }

  return c.json({ success: true, data: updated });
});

accountsApp.get("/:id/duplicates", tenantAuth, async (c) => {
  const id = c.req.param("id");
  const sourceAccount = await dbStore.accounts.findOne(id);
  if (!sourceAccount) {
    return c.json({ error: "Account not found" }, 404);
  }
  const allAccounts = await dbStore.accounts.findMany();
  const duplicates = calculateAccountDuplicates(sourceAccount, allAccounts);
  return c.json({ success: true, data: duplicates });
});

accountsApp.post("/:id/merge", tenantAuth, async (c) => {
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

accountsApp.get("/:id/hierarchy", tenantAuth, async (c) => {
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

accountsApp.get("/:id/consolidated-pipeline", tenantAuth, async (c) => {
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

accountsApp.get("/:id/team", tenantAuth, async (c) => {
  const id = c.req.param("id");
  const account = await dbStore.accounts.findOne(id);
  if (!account) {
    return c.json({ error: "Account not found" }, 404);
  }
  const team = await dbStore.accountTeams.findForAccount(id);
  return c.json({ success: true, data: team });
});

accountsApp.post("/:id/team", tenantAuth, async (c) => {
  const tenant = c.get("tenant");
  const id = c.req.param("id");
  const account = await dbStore.accounts.findOne(id);
  if (!account) {
    return c.json({ error: "Account not found" }, 404);
  }

  const body = await c.req.json().catch(() => ({}));
  const userId = body.userId;
  const role = body.role;

  const validation = validateAccountTeamMember(id, userId, role);
  if (!validation.success) {
    return c.json({ error: validation.error }, 400);
  }

  const team = await dbStore.accountTeams.findForAccount(id);
  const priorMember = team.find((t) => t.userId === userId);
  const action = priorMember
    ? "account_team_member_updated"
    : "account_team_member_added";

  const updatedMember = await dbStore.accountTeams.addOrUpdateMember(
    id,
    userId,
    role,
  );

  await dbStore.auditLogs.insert({
    orgId: tenant.orgId,
    recordId: id,
    recordType: "accounts",
    action,
    userId: tenant.userId,
    changes: {
      teamMember: { before: priorMember || null, after: updatedMember },
    },
  });

  await triggerOutboundWebhooks(tenant.orgId, "account.team_updated", {
    accountId: id,
    userId,
    role,
    action,
  });

  return c.json(
    { success: true, data: updatedMember },
    priorMember ? 200 : 201,
  );
});

accountsApp.delete("/:id/team/:userId", tenantAuth, async (c) => {
  const tenant = c.get("tenant");
  const id = c.req.param("id");
  const userId = c.req.param("userId");

  const account = await dbStore.accounts.findOne(id);
  if (!account) {
    return c.json({ error: "Account not found" }, 404);
  }

  const team = await dbStore.accountTeams.findForAccount(id);
  const priorMember = team.find((t) => t.userId === userId);
  if (!priorMember) {
    return c.json({ error: "Team member not found on this account" }, 404);
  }

  await dbStore.accountTeams.removeMember(id, userId);

  await dbStore.auditLogs.insert({
    orgId: tenant.orgId,
    recordId: id,
    recordType: "accounts",
    action: "account_team_member_removed",
    userId: tenant.userId,
    changes: {
      teamMember: { before: priorMember, after: null },
    },
  });

  await triggerOutboundWebhooks(tenant.orgId, "account.team_updated", {
    accountId: id,
    userId,
    role: priorMember.role,
    action: "account_team_member_removed",
  });

  return c.json({ success: true });
});
accountsApp.post("/:id/route", tenantAuth, async (c) => {
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

accountsApp.get("/:id/contracts", tenantAuth, async (c) => {
  const id = c.req.param("id");
  const account = await dbStore.accounts.findOne(id);
  if (!account) {
    return c.json({ error: "Account not found" }, 404);
  }
  const contracts = await dbStore.contracts.findForAccount(id);
  return c.json({ success: true, data: contracts });
});
