import {
  deleteMarketingSequenceStep,
  reorderMarketingSequenceSteps,
} from "@crm/core";
import { dbStore } from "@crm/db";
import { Hono } from "hono";
import { type Env, tenantAuth } from "../../middleware/tenantAuth";

export const stepsApp = new Hono<Env>();

stepsApp.post("/:id/steps", tenantAuth, async (c) => {
  const sequenceId = c.req.param("id");
  const tenant = c.get("tenant");
  const body = await c.req.json().catch(() => ({}));
  const {
    stepNumber,
    delayDays,
    templateId,
    waitCondition,
    replyToStepNumber,
    stepType = "email",
    webhookUrl,
    webhookPayload,
  } = body;

  const seq = await dbStore.marketingSequences.findOne(sequenceId);
  if (!seq) {
    return c.json({ success: false, error: "Sequence not found" }, 404);
  }

  if (stepNumber === undefined) {
    return c.json({ success: false, error: "stepNumber is required" }, 400);
  }

  if (
    stepType !== "email" &&
    stepType !== "webhook" &&
    stepType !== "task" &&
    stepType !== "sms" &&
    stepType !== "call"
  ) {
    return c.json(
      {
        success: false,
        error: "stepType must be email, webhook, task, sms, or call",
      },
      400,
    );
  }

  if (stepType === "email") {
    if (templateId === undefined) {
      return c.json(
        { success: false, error: "templateId is required for email steps" },
        400,
      );
    }
    const template = await dbStore.emailTemplates.findOne(templateId);
    if (!template) {
      return c.json({ success: false, error: "Email Template not found" }, 404);
    }
  } else if (stepType === "webhook") {
    if (
      !webhookUrl ||
      typeof webhookUrl !== "string" ||
      !/^https?:\/\//i.test(webhookUrl)
    ) {
      return c.json(
        {
          success: false,
          error:
            "webhookUrl is required and must be a valid HTTP/HTTPS URL for webhook steps",
        },
        400,
      );
    }
  } else if (stepType === "task") {
    if (!body.taskSubject || typeof body.taskSubject !== "string") {
      return c.json(
        { success: false, error: "taskSubject is required for task steps" },
        400,
      );
    }
  } else if (stepType === "sms") {
    if (!body.smsMessage || typeof body.smsMessage !== "string") {
      return c.json(
        { success: false, error: "smsMessage is required for sms steps" },
        400,
      );
    }
  } else if (stepType === "call") {
    if (!body.callScript || typeof body.callScript !== "string") {
      return c.json(
        { success: false, error: "callScript is required for call steps" },
        400,
      );
    }
  }

  if (replyToStepNumber !== undefined && replyToStepNumber !== null) {
    const replyStepNum = Number(replyToStepNumber);
    if (
      Number.isNaN(replyStepNum) ||
      !Number.isInteger(replyStepNum) ||
      replyStepNum < 1
    ) {
      return c.json(
        {
          success: false,
          error: "replyToStepNumber must be a positive integer",
        },
        400,
      );
    }
    if (replyStepNum >= Number(stepNumber)) {
      return c.json(
        {
          success: false,
          error:
            "replyToStepNumber must be strictly less than the current stepNumber",
        },
        400,
      );
    }

    const existingSteps =
      await dbStore.marketingSequenceSteps.findForSequence(sequenceId);
    const targetStepExists = existingSteps.some(
      (s) => s.stepNumber === replyStepNum,
    );
    if (!targetStepExists) {
      return c.json(
        {
          success: false,
          error: `Target sequence step with stepNumber ${replyStepNum} not found in this sequence`,
        },
        400,
      );
    }
  }

  if (waitCondition) {
    if (typeof waitCondition !== "object") {
      return c.json(
        { success: false, error: "waitCondition must be an object" },
        400,
      );
    }
    const { waitType, daysOfWeek, timeOfDay } = waitCondition;
    if (waitType !== "day_of_week" && waitType !== "duration") {
      return c.json(
        {
          success: false,
          error: "waitCondition.waitType must be day_of_week or duration",
        },
        400,
      );
    }
    if (waitType === "day_of_week") {
      if (
        !Array.isArray(daysOfWeek) ||
        daysOfWeek.some((d: unknown) => typeof d !== "number" || d < 0 || d > 6)
      ) {
        return c.json(
          {
            success: false,
            error:
              "waitCondition.daysOfWeek must be an array of numbers between 0 and 6",
          },
          400,
        );
      }
      if (
        timeOfDay !== undefined &&
        timeOfDay !== null &&
        (typeof timeOfDay !== "string" || !/^\d{2}:\d{2}$/.test(timeOfDay))
      ) {
        return c.json(
          {
            success: false,
            error: "waitCondition.timeOfDay must be in HH:mm format",
          },
          400,
        );
      }
    }
  }

  const step = await dbStore.marketingSequenceSteps.insert({
    orgId: tenant.orgId,
    sequenceId,
    stepNumber: Number(stepNumber),
    delayDays: delayDays !== undefined ? Number(delayDays) : 0,
    templateId: stepType === "email" ? templateId : null,
    waitCondition: waitCondition || null,
    replyToStepNumber:
      replyToStepNumber !== undefined && replyToStepNumber !== null
        ? Number(replyToStepNumber)
        : null,
    stepType,
    webhookUrl: stepType === "webhook" ? webhookUrl : null,
    webhookPayload: stepType === "webhook" ? webhookPayload || null : null,
    taskSubject: stepType === "task" ? body.taskSubject || null : null,
    taskBody: stepType === "task" ? body.taskBody || null : null,
    taskDueDays:
      stepType === "task"
        ? body.taskDueDays !== undefined && body.taskDueDays !== null
          ? Number(body.taskDueDays)
          : null
        : null,
    smsMessage: stepType === "sms" ? body.smsMessage || null : null,
    callScript: stepType === "call" ? body.callScript || null : null,
  });

  return c.json({ success: true, step });
});

stepsApp.post("/:id/steps/:stepId/reorder", tenantAuth, async (c) => {
  const sequenceId = c.req.param("id");
  const stepId = c.req.param("stepId");
  const tenant = c.get("tenant");
  const { newStepNumber } = await c.req.json();

  if (typeof newStepNumber !== "number") {
    return c.json({ success: false, error: "Invalid newStepNumber" }, 400);
  }

  try {
    const updatedSteps = await reorderMarketingSequenceSteps(
      dbStore,
      sequenceId,
      stepId,
      newStepNumber,
      tenant.orgId,
    );
    return c.json({ success: true, steps: updatedSteps });
  } catch (err) {
    const error = err as Error;
    if (
      error.message.includes("RLS Isolation Violation") ||
      error.message.includes("Tenant mismatch")
    ) {
      return c.json({ success: false, error: error.message }, 403);
    }
    if (error.message.includes("not found")) {
      return c.json({ success: false, error: error.message }, 404);
    }
    return c.json({ success: false, error: error.message }, 400);
  }
});

stepsApp.delete("/:id/steps/:stepId", tenantAuth, async (c) => {
  const sequenceId = c.req.param("id");
  const stepId = c.req.param("stepId");
  const tenant = c.get("tenant");

  try {
    const updatedSteps = await deleteMarketingSequenceStep(
      dbStore,
      sequenceId,
      stepId,
      tenant.orgId,
    );
    return c.json({ success: true, steps: updatedSteps });
  } catch (err) {
    const error = err as Error;
    if (
      error.message.includes("RLS Isolation Violation") ||
      error.message.includes("Tenant mismatch")
    ) {
      return c.json({ success: false, error: error.message }, 403);
    }
    if (error.message.includes("not found")) {
      return c.json({ success: false, error: error.message }, 404);
    }
    return c.json({ success: false, error: error.message }, 400);
  }
});

stepsApp.get("/:id/steps/:stepId/split-test", tenantAuth, async (c) => {
  const sequenceId = c.req.param("id");
  const stepId = c.req.param("stepId");

  const seq = await dbStore.marketingSequences.findOne(sequenceId);
  if (!seq) {
    return c.json({ success: false, error: "Sequence not found" }, 404);
  }

  const step = await dbStore.marketingSequenceSteps.findOne(stepId);
  if (!step || step.sequenceId !== sequenceId) {
    return c.json({ success: false, error: "Sequence step not found" }, 404);
  }

  const splitTest =
    await dbStore.marketingSequenceStepSplitTests.findForStep(stepId);
  return c.json({ success: true, data: splitTest });
});

stepsApp.post("/:id/steps/:stepId/split-test", tenantAuth, async (c) => {
  const sequenceId = c.req.param("id");
  const stepId = c.req.param("stepId");
  const tenant = c.get("tenant");

  const seq = await dbStore.marketingSequences.findOne(sequenceId);
  if (!seq) {
    return c.json({ success: false, error: "Sequence not found" }, 404);
  }

  const step = await dbStore.marketingSequenceSteps.findOne(stepId);
  if (!step || step.sequenceId !== sequenceId) {
    return c.json({ success: false, error: "Sequence step not found" }, 404);
  }

  const body = await c.req.json().catch(() => ({}));
  const {
    variantTemplateId,
    splitWeight,
    isActive,
    autoPromoteWinner,
    minSendsToEvaluate,
    evaluationMetric,
  } = body;

  if (!variantTemplateId) {
    return c.json(
      { success: false, error: "variantTemplateId is required" },
      400,
    );
  }

  if (
    autoPromoteWinner !== undefined &&
    autoPromoteWinner !== 0 &&
    autoPromoteWinner !== 1
  ) {
    return c.json(
      { success: false, error: "autoPromoteWinner must be 0 or 1" },
      400,
    );
  }

  if (
    minSendsToEvaluate !== undefined &&
    (typeof minSendsToEvaluate !== "number" || minSendsToEvaluate <= 0)
  ) {
    return c.json(
      {
        success: false,
        error: "minSendsToEvaluate must be a positive integer",
      },
      400,
    );
  }

  if (
    evaluationMetric !== undefined &&
    evaluationMetric !== "open_rate" &&
    evaluationMetric !== "click_rate"
  ) {
    return c.json(
      {
        success: false,
        error: "evaluationMetric must be open_rate or click_rate",
      },
      400,
    );
  }

  const template = await dbStore.emailTemplates.findOne(variantTemplateId);
  if (!template) {
    return c.json({ success: false, error: "Variant template not found" }, 404);
  }

  const existing =
    await dbStore.marketingSequenceStepSplitTests.findForStep(stepId);
  if (existing) {
    await dbStore.marketingSequenceStepSplitTests.delete(existing.id);
  }

  const splitTest = await dbStore.marketingSequenceStepSplitTests.insert({
    orgId: tenant.orgId,
    stepId,
    variantTemplateId,
    splitWeight: typeof splitWeight === "number" ? splitWeight : 50,
    isActive: isActive === 0 ? 0 : 1,
    autoPromoteWinner:
      typeof autoPromoteWinner === "number" ? autoPromoteWinner : 0,
    minSendsToEvaluate:
      typeof minSendsToEvaluate === "number" ? minSendsToEvaluate : 10,
    evaluationMetric:
      typeof evaluationMetric === "string" ? evaluationMetric : "open_rate",
  });

  return c.json({ success: true, data: splitTest });
});

stepsApp.post(
  "/:id/steps/:stepId/split-test/allocate",
  tenantAuth,
  async (c) => {
    const sequenceId = c.req.param("id");
    const stepId = c.req.param("stepId");
    const tenant = c.get("tenant");

    const seq = await dbStore.marketingSequences.findOne(sequenceId);
    if (!seq) {
      return c.json({ success: false, error: "Sequence not found" }, 404);
    }

    const step = await dbStore.marketingSequenceSteps.findOne(stepId);
    if (!step || step.sequenceId !== sequenceId) {
      return c.json({ success: false, error: "Sequence step not found" }, 404);
    }

    const body = await c.req.json().catch(() => ({}));
    const { membershipId, allocatedTemplateId } = body;

    if (!membershipId || !allocatedTemplateId) {
      return c.json(
        {
          success: false,
          error: "membershipId and allocatedTemplateId are required",
        },
        400,
      );
    }

    const membership =
      await dbStore.marketingSequenceMemberships.findOne(membershipId);
    if (!membership || membership.sequenceId !== sequenceId) {
      return c.json(
        { success: false, error: "Sequence membership not found" },
        404,
      );
    }

    const template = await dbStore.emailTemplates.findOne(allocatedTemplateId);
    if (!template) {
      return c.json(
        { success: false, error: "Allocated template not found" },
        404,
      );
    }

    const allocation = await dbStore.marketingSequenceAbAllocations.insert({
      orgId: tenant.orgId,
      membershipId,
      stepId,
      allocatedTemplateId,
    });

    return c.json({ success: true, data: allocation });
  },
);

stepsApp.get("/:id/steps/:stepId/branch", tenantAuth, async (c) => {
  const sequenceId = c.req.param("id");
  const stepId = c.req.param("stepId");

  const seq = await dbStore.marketingSequences.findOne(sequenceId);
  if (!seq) {
    return c.json({ success: false, error: "Sequence not found" }, 404);
  }

  const step = await dbStore.marketingSequenceSteps.findOne(stepId);
  if (!step || step.sequenceId !== sequenceId) {
    return c.json({ success: false, error: "Sequence step not found" }, 404);
  }

  const branch =
    await dbStore.marketingSequenceStepBranches.findForStep(stepId);
  if (!branch) {
    return c.json({ success: false, error: "Branch not found" }, 404);
  }
  return c.json({ success: true, data: branch });
});

stepsApp.post("/:id/steps/:stepId/branch", tenantAuth, async (c) => {
  const sequenceId = c.req.param("id");
  const stepId = c.req.param("stepId");
  const tenant = c.get("tenant");

  const seq = await dbStore.marketingSequences.findOne(sequenceId);
  if (!seq) {
    return c.json({ success: false, error: "Sequence not found" }, 404);
  }

  const step = await dbStore.marketingSequenceSteps.findOne(stepId);
  if (!step || step.sequenceId !== sequenceId) {
    return c.json({ success: false, error: "Sequence step not found" }, 404);
  }

  const body = await c.req.json().catch(() => ({}));
  const {
    branchType,
    evaluationWindowDays,
    trueNextStepNumber,
    falseNextStepNumber,
  } = body;

  if (
    !branchType ||
    typeof trueNextStepNumber !== "number" ||
    typeof falseNextStepNumber !== "number"
  ) {
    return c.json(
      {
        success: false,
        error:
          "branchType, trueNextStepNumber, and falseNextStepNumber are required",
      },
      400,
    );
  }

  const existing =
    await dbStore.marketingSequenceStepBranches.findForStep(stepId);
  if (existing) {
    await dbStore.marketingSequenceStepBranches.delete(existing.id);
  }

  const branch = await dbStore.marketingSequenceStepBranches.insert({
    orgId: tenant.orgId,
    stepId,
    branchType,
    evaluationWindowDays:
      typeof evaluationWindowDays === "number" ? evaluationWindowDays : 3,
    trueNextStepNumber,
    falseNextStepNumber,
  });

  return c.json({ success: true, data: branch });
});

stepsApp.delete("/:id/steps/:stepId/branch", tenantAuth, async (c) => {
  const sequenceId = c.req.param("id");
  const stepId = c.req.param("stepId");

  const seq = await dbStore.marketingSequences.findOne(sequenceId);
  if (!seq) {
    return c.json({ success: false, error: "Sequence not found" }, 404);
  }

  const step = await dbStore.marketingSequenceSteps.findOne(stepId);
  if (!step || step.sequenceId !== sequenceId) {
    return c.json({ success: false, error: "Sequence step not found" }, 404);
  }

  const branch =
    await dbStore.marketingSequenceStepBranches.findForStep(stepId);
  if (!branch) {
    return c.json({ success: false, error: "Branch not found" }, 404);
  }

  await dbStore.marketingSequenceStepBranches.delete(branch.id);
  return c.json({ success: true });
});

stepsApp.get("/steps/:stepId/link-actions", tenantAuth, async (c) => {
  const stepId = c.req.param("stepId");
  const actions =
    await dbStore.marketingSequenceLinkActions.findForStep(stepId);
  return c.json({ success: true, data: actions });
});

stepsApp.post("/steps/:stepId/link-actions", tenantAuth, async (c) => {
  const stepId = c.req.param("stepId");
  const tenant = c.get("tenant");
  const body = await c.req.json().catch(() => ({}));
  const { targetUrl, actionType, actionConfig } = body;

  if (!targetUrl || !actionType || !actionConfig) {
    return c.json(
      {
        success: false,
        error: "targetUrl, actionType, and actionConfig are required",
      },
      400,
    );
  }
  if (actionType !== "field_update" && actionType !== "create_task") {
    return c.json(
      {
        success: false,
        error: "actionType must be 'field_update' or 'create_task'",
      },
      400,
    );
  }

  const action = await dbStore.marketingSequenceLinkActions.insert({
    orgId: tenant.orgId,
    stepId,
    targetUrl,
    actionType,
    actionConfig,
  });

  return c.json({ success: true, data: action });
});

stepsApp.delete("/steps/link-actions/:id", tenantAuth, async (c) => {
  const id = c.req.param("id");
  const deleted = await dbStore.marketingSequenceLinkActions.delete(id);
  if (!deleted) {
    return c.json(
      { success: false, error: "Link action not found or unauthorized" },
      404,
    );
  }
  return c.json({ success: true });
});

stepsApp.get("/steps/:stepId/open-actions", tenantAuth, async (c) => {
  const stepId = c.req.param("stepId");
  const actions =
    await dbStore.marketingSequenceOpenActions.findForStep(stepId);
  return c.json({ success: true, data: actions });
});

stepsApp.post("/steps/:stepId/open-actions", tenantAuth, async (c) => {
  const stepId = c.req.param("stepId");
  const tenant = c.get("tenant");
  const body = await c.req.json().catch(() => ({}));
  const { actionType, actionConfig } = body;

  if (!actionType || !actionConfig) {
    return c.json(
      {
        success: false,
        error: "actionType and actionConfig are required",
      },
      400,
    );
  }
  if (actionType !== "field_update" && actionType !== "create_task") {
    return c.json(
      {
        success: false,
        error: "actionType must be 'field_update' or 'create_task'",
      },
      400,
    );
  }

  const action = await dbStore.marketingSequenceOpenActions.insert({
    orgId: tenant.orgId,
    stepId,
    actionType,
    actionConfig,
  });

  return c.json({ success: true, data: action });
});

stepsApp.delete("/steps/open-actions/:id", tenantAuth, async (c) => {
  const id = c.req.param("id");
  const deleted = await dbStore.marketingSequenceOpenActions.delete(id);
  if (!deleted) {
    return c.json(
      { success: false, error: "Open action not found or unauthorized" },
      404,
    );
  }
  return c.json({ success: true });
});

stepsApp.get("/steps/:stepId/reply-actions", tenantAuth, async (c) => {
  const stepId = c.req.param("stepId");
  const actions =
    await dbStore.marketingSequenceReplyActions.findForStep(stepId);
  return c.json({ success: true, data: actions });
});

stepsApp.post("/steps/:stepId/reply-actions", tenantAuth, async (c) => {
  const stepId = c.req.param("stepId");
  const tenant = c.get("tenant");
  const body = await c.req.json().catch(() => ({}));
  const { actionType, actionConfig } = body;

  if (!actionType || !actionConfig) {
    return c.json(
      {
        success: false,
        error: "actionType and actionConfig are required",
      },
      400,
    );
  }
  if (actionType !== "field_update" && actionType !== "create_task") {
    return c.json(
      {
        success: false,
        error: "actionType must be 'field_update' or 'create_task'",
      },
      400,
    );
  }

  const action = await dbStore.marketingSequenceReplyActions.insert({
    orgId: tenant.orgId,
    stepId,
    actionType,
    actionConfig,
  });

  return c.json({ success: true, data: action });
});

stepsApp.delete("/steps/reply-actions/:id", tenantAuth, async (c) => {
  const id = c.req.param("id");
  const deleted = await dbStore.marketingSequenceReplyActions.delete(id);
  if (!deleted) {
    return c.json(
      { success: false, error: "Reply action not found or unauthorized" },
      404,
    );
  }
  return c.json({ success: true });
});
