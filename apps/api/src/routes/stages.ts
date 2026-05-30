import {
  type DBOpportunityStageGate,
  type DBStageGuidance,
  dbStore,
} from "@crm/db";
import { Hono } from "hono";
import { type Env, tenantAuth } from "../middleware/tenantAuth";

/** Sales path stage guidance + opportunity stage gates. */
export const stageGuidanceApp = new Hono<Env>();
export const stageGatesApp = new Hono<Env>();

stageGuidanceApp.get("/", tenantAuth, async (c) => {
  const guidance = await dbStore.stageGuidance.findMany();
  return c.json({ success: true, data: guidance });
});

stageGuidanceApp.get("/:objectType/:stage", tenantAuth, async (c) => {
  const { objectType, stage } = c.req.param();
  const allGuidance = await dbStore.stageGuidance.findMany();
  const active = allGuidance.find(
    (g) => g.objectType === objectType && g.stage === stage && g.isActive,
  );
  return c.json({ success: true, data: active || null });
});

stageGuidanceApp.post("/", tenantAuth, async (c) => {
  const tenant = c.get("tenant");
  const body = await c.req.json().catch(() => ({}));
  const { id, objectType, stage, keyFields, guidanceText, isActive } = body;

  if (!objectType || !stage || !keyFields || guidanceText === undefined) {
    return c.json({ error: "Missing required stage guidance parameters" }, 400);
  }

  let entry: DBStageGuidance | null = null;

  if (id) {
    const existing = await dbStore.stageGuidance.findOne(id);
    if (!existing) {
      return c.json({ error: "Stage guidance not found" }, 404);
    }
    entry = await dbStore.stageGuidance.update(id, {
      objectType,
      stage,
      keyFields,
      guidanceText,
      isActive: isActive !== undefined ? Boolean(isActive) : existing.isActive,
    });

    await dbStore.auditLogs.insert({
      orgId: tenant.orgId,
      recordId: id,
      recordType: "stage_guidance",
      action: "update",
      userId: tenant.userId,
      changes: null,
    });
  } else {
    entry = await dbStore.stageGuidance.insert({
      orgId: tenant.orgId,
      objectType,
      stage,
      keyFields,
      guidanceText,
      isActive: isActive !== undefined ? Boolean(isActive) : true,
    });

    await dbStore.auditLogs.insert({
      orgId: tenant.orgId,
      recordId: entry.id,
      recordType: "stage_guidance",
      action: "create",
      userId: tenant.userId,
      changes: null,
    });
  }

  return c.json({ success: true, data: entry }, id ? 200 : 201);
});

stageGatesApp.get("/", tenantAuth, async (c) => {
  const gates = await dbStore.opportunityStageGates.findMany();
  return c.json({ success: true, data: gates });
});

stageGatesApp.post("/", tenantAuth, async (c) => {
  const tenant = c.get("tenant");
  const body = await c.req.json().catch(() => ({}));
  const {
    id,
    targetStage,
    field,
    operator,
    expectedValue,
    errorMessage,
    isActive,
  } = body;

  if (!targetStage || !field || !operator || !errorMessage) {
    return c.json({ error: "Missing required stage gate parameters" }, 400);
  }

  let gate: DBOpportunityStageGate | null = null;

  if (id) {
    const existing = await dbStore.opportunityStageGates.findOne(id);
    if (!existing) {
      return c.json({ error: "Stage gate not found" }, 404);
    }
    gate = await dbStore.opportunityStageGates.update(id, {
      targetStage,
      field,
      operator,
      expectedValue:
        expectedValue !== undefined
          ? String(expectedValue)
          : existing.expectedValue,
      errorMessage,
      isActive: isActive !== undefined ? Boolean(isActive) : existing.isActive,
    });

    await dbStore.auditLogs.insert({
      orgId: tenant.orgId,
      recordId: id,
      recordType: "opportunity_stage_gates",
      action: "update",
      userId: tenant.userId,
      changes: null,
    });
  } else {
    gate = await dbStore.opportunityStageGates.insert({
      orgId: tenant.orgId,
      targetStage,
      field,
      operator,
      expectedValue: expectedValue !== undefined ? String(expectedValue) : null,
      errorMessage,
      isActive: isActive !== undefined ? Boolean(isActive) : true,
    });

    await dbStore.auditLogs.insert({
      orgId: tenant.orgId,
      recordId: gate.id,
      recordType: "opportunity_stage_gates",
      action: "create",
      userId: tenant.userId,
      changes: null,
    });
  }

  return c.json({ success: true, data: gate }, 201);
});
