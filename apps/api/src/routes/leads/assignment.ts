import { evaluateLeadAssignment } from "@crm/core";
import { dbStore } from "@crm/db";
import { OpenAPIHono } from "@hono/zod-openapi";
import { type Env, tenantAuth } from "../../middleware/tenantAuth";

export const assignmentRouter = new OpenAPIHono<Env>();
export const leadAssignmentRulesApp = new OpenAPIHono<Env>();

assignmentRouter.use(tenantAuth);
leadAssignmentRulesApp.use(tenantAuth);

assignmentRouter.post("/:id/assign", tenantAuth, async (c) => {
  const tenant = c.get("tenant");
  const id = c.req.param("id");

  const lead = await dbStore.leads.findOne(id);
  if (!lead) {
    return c.json({ error: "Lead not found" }, 404);
  }

  const rules = await dbStore.leadAssignmentRules.findMany();
  const activeRule = rules.find((r) => r.isActive === 1);
  if (!activeRule) {
    return c.json({
      success: false,
      message: "No active assignment rule found.",
    });
  }

  const allEntries = await dbStore.leadAssignmentRuleEntries.findMany();
  const activeEntries = allEntries
    .filter((e) => e.ruleId === activeRule.id)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  if (activeEntries.length === 0) {
    return c.json({
      success: false,
      message: "Active assignment rule has no entries.",
    });
  }

  const evalLead = {
    ...lead,
    custom: lead.custom || null,
  };
  const matchResult = evaluateLeadAssignment(evalLead, activeEntries);

  if (!matchResult) {
    return c.json({
      success: false,
      message: "No matching routing entry found for this lead.",
    });
  }

  const previousOwnerId = lead.ownerId;
  const updatedLead = await dbStore.leads.update(id, {
    ownerId: matchResult.newOwnerId,
  });

  const matchedEntry = activeEntries.find(
    (e) => e.id === matchResult.matchedEntryId,
  );
  if (matchedEntry && matchedEntry.routingMethod === "round_robin") {
    await dbStore.leadAssignmentRuleEntries.update(matchedEntry.id, {
      lastAssignedIndex: matchResult.newLastAssignedIndex,
    });
  }

  await dbStore.auditLogs.insert({
    orgId: tenant.orgId,
    recordId: id,
    recordType: "leads",
    action: "assign",
    userId: tenant.userId,
    changes: {
      ownerId: { before: previousOwnerId, after: matchResult.newOwnerId },
    },
  });

  return c.json({
    success: true,
    data: updatedLead,
    matchInfo: {
      ruleId: activeRule.id,
      entryId: matchResult.matchedEntryId,
      newOwnerId: matchResult.newOwnerId,
    },
  });
});

leadAssignmentRulesApp.post("/", tenantAuth, async (c) => {
  const tenant = c.get("tenant");
  const body = await c.req.json().catch(() => ({}));
  const { name, isActive, entries } = body;

  if (!name) {
    return c.json({ error: "Missing required rule parameter: name" }, 400);
  }

  if (isActive === 1) {
    const existingRules = await dbStore.leadAssignmentRules.findMany();
    for (const rule of existingRules) {
      if (rule.isActive === 1) {
        await dbStore.leadAssignmentRules.update(rule.id, { isActive: 0 });
      }
    }
  }

  const newRule = await dbStore.leadAssignmentRules.insert({
    orgId: tenant.orgId,
    name,
    isActive: isActive !== undefined ? Number(isActive) : 0,
  });

  const createdEntries = [];
  if (Array.isArray(entries)) {
    for (const entry of entries) {
      const { sortOrder, routingMethod, routingUserIds, criteria } = entry;
      if (
        sortOrder !== undefined &&
        routingMethod &&
        Array.isArray(routingUserIds) &&
        Array.isArray(criteria)
      ) {
        const newEntry = await dbStore.leadAssignmentRuleEntries.insert({
          orgId: tenant.orgId,
          ruleId: newRule.id,
          sortOrder: Number(sortOrder),
          routingMethod,
          routingUserIds,
          lastAssignedIndex: -1,
          criteria,
        });
        createdEntries.push(newEntry);
      }
    }
  }

  return c.json({
    success: true,
    data: { ...newRule, entries: createdEntries },
  });
});

leadAssignmentRulesApp.get("/", tenantAuth, async (c) => {
  const rules = await dbStore.leadAssignmentRules.findMany();
  const allEntries = await dbStore.leadAssignmentRuleEntries.findMany();

  const data = rules.map((r) => {
    const entries = allEntries
      .filter((e) => e.ruleId === r.id)
      .sort((a, b) => a.sortOrder - b.sortOrder);
    return { ...r, entries };
  });

  return c.json({ success: true, data });
});
