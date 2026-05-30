import {
  enrollInSequence,
  enrollSegmentInSequence,
  getMarketingSequenceMemberLogs,
  pauseMarketingSequence,
  resumeMarketingSequence,
} from "@crm/core";
import { dbStore } from "@crm/db";
import { Hono } from "hono";
import { type Env, tenantAuth } from "../../middleware/tenantAuth";

export const enrollmentApp = new Hono<Env>();

enrollmentApp.post("/:id/enroll", tenantAuth, async (c) => {
  const sequenceId = c.req.param("id");
  const tenant = c.get("tenant");
  const body = await c.req.json().catch(() => ({}));
  const { recordType, recordId } = body;

  if (!recordType || !recordId) {
    return c.json(
      { success: false, error: "recordType and recordId are required" },
      400,
    );
  }

  if (recordType !== "lead" && recordType !== "contact") {
    return c.json(
      { success: false, error: "recordType must be lead or contact" },
      400,
    );
  }

  const seq = await dbStore.marketingSequences.findOne(sequenceId);
  if (!seq) {
    return c.json({ success: false, error: "Sequence not found" }, 404);
  }

  if (recordType === "lead") {
    const lead = await dbStore.leads.findOne(recordId);
    if (!lead) {
      return c.json({ success: false, error: "Lead not found" }, 404);
    }
  } else {
    const contact = await dbStore.contacts.findOne(recordId);
    if (!contact) {
      return c.json({ success: false, error: "Contact not found" }, 404);
    }
  }

  try {
    const membership = await enrollInSequence(
      dbStore,
      tenant.orgId,
      sequenceId,
      recordType,
      recordId,
    );
    return c.json({ success: true, membership });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return c.json({ success: false, error: message }, 400);
  }
});

enrollmentApp.post("/:id/enroll-segment", tenantAuth, async (c) => {
  const sequenceId = c.req.param("id");
  const tenant = c.get("tenant");
  const body = await c.req.json().catch(() => ({}));
  const { segmentId } = body;

  if (!segmentId) {
    return c.json({ success: false, error: "segmentId is required" }, 400);
  }

  try {
    const result = await enrollSegmentInSequence(
      dbStore,
      tenant.orgId,
      segmentId,
      sequenceId,
    );
    return c.json({ success: true, ...result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return c.json(
      {
        success: false,
        error: msg || "Failed to enroll segment in sequence",
      },
      400,
    );
  }
});

enrollmentApp.post("/:id/pause", tenantAuth, async (c) => {
  const sequenceId = c.req.param("id");
  const tenant = c.get("tenant");

  const sequence = await dbStore.marketingSequences.findOne(sequenceId);
  if (!sequence) {
    return c.json({ success: false, error: "Sequence not found" }, 404);
  }

  try {
    const paused = await pauseMarketingSequence(
      dbStore,
      sequenceId,
      tenant.orgId,
    );
    return c.json({ success: true, sequence: paused });
  } catch (err) {
    const error = err as Error;
    return c.json({ success: false, error: error.message }, 400);
  }
});

enrollmentApp.post("/:id/resume", tenantAuth, async (c) => {
  const sequenceId = c.req.param("id");
  const tenant = c.get("tenant");

  const sequence = await dbStore.marketingSequences.findOne(sequenceId);
  if (!sequence) {
    return c.json({ success: false, error: "Sequence not found" }, 404);
  }

  try {
    const resumed = await resumeMarketingSequence(
      dbStore,
      sequenceId,
      tenant.orgId,
    );
    return c.json({ success: true, sequence: resumed });
  } catch (err) {
    const error = err as Error;
    return c.json({ success: false, error: error.message }, 400);
  }
});

enrollmentApp.get("/:id/members", tenantAuth, async (c) => {
  const sequenceId = c.req.param("id");
  const seq = await dbStore.marketingSequences.findOne(sequenceId);
  if (!seq) {
    return c.json({ success: false, error: "Sequence not found" }, 404);
  }

  const memberships =
    await dbStore.marketingSequenceMemberships.findForSequence(sequenceId);
  return c.json({ success: true, data: memberships });
});

enrollmentApp.get("/:id/members/:memberId/logs", tenantAuth, async (c) => {
  const sequenceId = c.req.param("id");
  const memberId = c.req.param("memberId");
  const tenant = c.get("tenant");

  try {
    const logs = await getMarketingSequenceMemberLogs(
      dbStore,
      sequenceId,
      memberId,
      tenant.orgId,
    );
    return c.json({ success: true, data: logs });
  } catch (err) {
    const error = err as Error;
    const errorMsg = error.message || "";
    if (errorMsg.includes("RLS Isolation Violation")) {
      return c.json({ success: false, error: errorMsg }, 403);
    }
    if (errorMsg.includes("not found")) {
      return c.json({ success: false, error: errorMsg }, 404);
    }
    if (errorMsg.includes("does not belong")) {
      return c.json({ success: false, error: errorMsg }, 400);
    }
    return c.json({ success: false, error: errorMsg }, 500);
  }
});

enrollmentApp.get("/suppressions", tenantAuth, async (c) => {
  const suppressions = await dbStore.marketingSequenceSuppressions.findMany();
  return c.json({ success: true, data: suppressions });
});

enrollmentApp.post("/suppressions", tenantAuth, async (c) => {
  const tenant = c.get("tenant");
  const body = await c.req.json().catch(() => ({}));
  const { recordType, recordId, pattern, reason } = body;

  if (!recordType) {
    return c.json({ success: false, error: "Record type is required" }, 400);
  }

  const suppression = await dbStore.marketingSequenceSuppressions.insert({
    orgId: tenant.orgId,
    recordType,
    recordId: recordId || null,
    pattern: pattern || null,
    reason: reason || "opt_out",
  });

  return c.json({ success: true, data: suppression });
});

enrollmentApp.delete("/suppressions/:id", tenantAuth, async (c) => {
  const id = c.req.param("id");
  const deleted = await dbStore.marketingSequenceSuppressions.delete(id);
  if (!deleted) {
    return c.json(
      { success: false, error: "Suppression record not found or unauthorized" },
      404,
    );
  }
  return c.json({ success: true, message: "Suppression removed" });
});

enrollmentApp.get("/:id/exclusions", tenantAuth, async (c) => {
  const sequenceId = c.req.param("id");
  const seq = await dbStore.marketingSequences.findOne(sequenceId);
  if (!seq) {
    return c.json({ success: false, error: "Sequence not found" }, 404);
  }

  const exclusions =
    await dbStore.marketingSequenceExclusions.findForSequence(sequenceId);
  return c.json({ success: true, data: exclusions });
});

enrollmentApp.post("/:id/exclusions", tenantAuth, async (c) => {
  const sequenceId = c.req.param("id");
  const tenant = c.get("tenant");
  const body = await c.req.json().catch(() => ({}));
  const { exclusionType, exclusionValue } = body;

  if (!exclusionType || !exclusionValue) {
    return c.json(
      { success: false, error: "Exclusion type and value are required" },
      400,
    );
  }

  const seq = await dbStore.marketingSequences.findOne(sequenceId);
  if (!seq) {
    return c.json({ success: false, error: "Sequence not found" }, 404);
  }

  const exclusion = await dbStore.marketingSequenceExclusions.insert({
    orgId: tenant.orgId,
    sequenceId,
    exclusionType,
    exclusionValue,
  });

  return c.json({ success: true, data: exclusion });
});

enrollmentApp.delete("/:id/exclusions/:exclusionId", tenantAuth, async (c) => {
  const exclusionId = c.req.param("exclusionId");
  const deleted = await dbStore.marketingSequenceExclusions.delete(exclusionId);
  if (!deleted) {
    return c.json(
      { success: false, error: "Exclusion rule not found or unauthorized" },
      404,
    );
  }
  return c.json({ success: true, message: "Exclusion removed" });
});

enrollmentApp.post(
  "/memberships/:membershipId/snooze",
  tenantAuth,
  async (c) => {
    const membershipId = c.req.param("membershipId");
    const tenant = c.get("tenant");
    const body = await c.req.json().catch(() => ({}));
    const { snoozeUntil, reason } = body;

    if (!snoozeUntil) {
      return c.json({ success: false, error: "snoozeUntil is required" }, 400);
    }

    const membership =
      await dbStore.marketingSequenceMemberships.findOne(membershipId);
    if (!membership || membership.orgId !== tenant.orgId) {
      return c.json({ success: false, error: "Membership not found" }, 404);
    }

    const snoozeDate = new Date(snoozeUntil);
    if (Number.isNaN(snoozeDate.getTime())) {
      return c.json(
        { success: false, error: "Invalid snoozeUntil date format" },
        400,
      );
    }

    const originalStatus = membership.status;
    const originalSnoozeUntil = membership.snoozeUntil;

    const updated = await dbStore.marketingSequenceMemberships.update(
      membershipId,
      {
        status: "snoozed",
        snoozeUntil: snoozeDate,
        snoozeReason: reason || null,
      },
    );

    await dbStore.auditLogs.insert({
      orgId: tenant.orgId,
      recordId: membershipId,
      recordType: "marketing_sequence_memberships",
      action: "membership_snoozed",
      userId: "00000000-0000-0000-0000-000000000000",
      changes: {
        status: { before: originalStatus, after: "snoozed" },
        snoozeUntil: {
          before: originalSnoozeUntil
            ? new Date(originalSnoozeUntil).toISOString()
            : null,
          after: snoozeDate.toISOString(),
        },
      },
    });

    return c.json({ success: true, data: updated });
  },
);

enrollmentApp.post(
  "/memberships/:membershipId/resume",
  tenantAuth,
  async (c) => {
    const membershipId = c.req.param("membershipId");
    const tenant = c.get("tenant");

    const membership =
      await dbStore.marketingSequenceMemberships.findOne(membershipId);
    if (!membership || membership.orgId !== tenant.orgId) {
      return c.json({ success: false, error: "Membership not found" }, 404);
    }

    const originalStatus = membership.status;
    const originalSnoozeUntil = membership.snoozeUntil;

    const updated = await dbStore.marketingSequenceMemberships.update(
      membershipId,
      {
        status: "active",
        snoozeUntil: null,
        snoozeReason: null,
        nextExecutionAt: new Date(),
      },
    );

    await dbStore.auditLogs.insert({
      orgId: tenant.orgId,
      recordId: membershipId,
      recordType: "marketing_sequence_memberships",
      action: "membership_resumed",
      userId: "00000000-0000-0000-0000-000000000000",
      changes: {
        status: { before: originalStatus, after: "active" },
        snoozeUntil: {
          before: originalSnoozeUntil
            ? originalSnoozeUntil.toISOString()
            : null,
          after: null,
        },
      },
    });

    return c.json({ success: true, data: updated });
  },
);

enrollmentApp.get("/:id/exit-triggers", tenantAuth, async (c) => {
  const sequenceId = c.req.param("id");
  const seq = await dbStore.marketingSequences.findOne(sequenceId);
  if (!seq) {
    return c.json({ success: false, error: "Sequence not found" }, 404);
  }
  const triggers =
    await dbStore.marketingSequenceExitTriggers.findForSequence(sequenceId);
  return c.json({ success: true, data: triggers });
});

enrollmentApp.post("/:id/exit-triggers", tenantAuth, async (c) => {
  const sequenceId = c.req.param("id");
  const tenant = c.get("tenant");
  const seq = await dbStore.marketingSequences.findOne(sequenceId);
  if (!seq) {
    return c.json({ success: false, error: "Sequence not found" }, 404);
  }

  const body = await c.req.json().catch(() => ({}));
  const { triggerType, criteria } = body;

  if (
    !triggerType ||
    (triggerType !== "lead_status_changed" &&
      triggerType !== "opportunity_stage_changed")
  ) {
    return c.json(
      { success: false, error: "Invalid or missing triggerType" },
      400,
    );
  }

  if (!criteria) {
    return c.json({ success: false, error: "Missing trigger criteria" }, 400);
  }

  const trigger = await dbStore.marketingSequenceExitTriggers.insert({
    orgId: tenant.orgId,
    sequenceId,
    triggerType,
    criteria,
    isActive: 1,
  });

  return c.json({ success: true, data: trigger });
});

enrollmentApp.delete("/:id/exit-triggers/:triggerId", tenantAuth, async (c) => {
  const sequenceId = c.req.param("id");
  const triggerId = c.req.param("triggerId");

  const seq = await dbStore.marketingSequences.findOne(sequenceId);
  if (!seq) {
    return c.json({ success: false, error: "Sequence not found" }, 404);
  }

  const trigger =
    await dbStore.marketingSequenceExitTriggers.findOne(triggerId);
  if (!trigger) {
    return c.json({ success: false, error: "Exit trigger not found" }, 404);
  }

  if (trigger.sequenceId !== sequenceId) {
    return c.json(
      { success: false, error: "Exit trigger sequence mismatch" },
      400,
    );
  }

  await dbStore.marketingSequenceExitTriggers.delete(triggerId);
  return c.json({ success: true });
});

enrollmentApp.get("/:id/goals", tenantAuth, async (c) => {
  const sequenceId = c.req.param("id");
  const seq = await dbStore.marketingSequences.findOne(sequenceId);
  if (!seq) {
    return c.json({ success: false, error: "Sequence not found" }, 404);
  }

  const goals =
    await dbStore.marketingSequenceGoals.findForSequence(sequenceId);
  return c.json({ success: true, data: goals });
});

enrollmentApp.post("/:id/goals", tenantAuth, async (c) => {
  const sequenceId = c.req.param("id");
  const tenant = c.get("tenant");
  const body = await c.req.json().catch(() => ({}));
  const { goalType, targetValue } = body;

  if (!goalType) {
    return c.json({ success: false, error: "Goal type is required" }, 400);
  }

  const seq = await dbStore.marketingSequences.findOne(sequenceId);
  if (!seq) {
    return c.json({ success: false, error: "Sequence not found" }, 404);
  }

  // Deactivate/delete any existing goals for simplicity
  const existing =
    await dbStore.marketingSequenceGoals.findForSequence(sequenceId);
  for (const g of existing) {
    await dbStore.marketingSequenceGoals.delete(g.id);
  }

  const goal = await dbStore.marketingSequenceGoals.insert({
    orgId: tenant.orgId,
    sequenceId,
    goalType,
    targetValue: targetValue || null,
    isActive: 1,
  });

  return c.json({ success: true, data: goal });
});
