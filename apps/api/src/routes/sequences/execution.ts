import {
  compileEmailTemplate,
  executePendingSequenceSteps,
  handleEmailDeliveryEvent,
} from "@crm/core";
import { dbStore } from "@crm/db";
import { Hono } from "hono";
import { type Env, tenantAuth } from "../../middleware/tenantAuth";

export const executionApp = new Hono<Env>();

executionApp.post("/execute", tenantAuth, async (c) => {
  const processed = await executePendingSequenceSteps(dbStore, new Date());
  return c.json({ success: true, processedCount: processed });
});

executionApp.post("/preview", tenantAuth, async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const { subject, body: bodyText, recordType, recordId } = body;

  if (!subject && !bodyText) {
    return c.json(
      { success: false, error: "Subject or body is required" },
      400,
    );
  }
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

  let record: Record<string, unknown> | null = null;
  if (recordType === "lead") {
    record = (await dbStore.leads.findOne(recordId)) as Record<
      string,
      unknown
    > | null;
  } else if (recordType === "contact") {
    record = (await dbStore.contacts.findOne(recordId)) as Record<
      string,
      unknown
    > | null;
  }

  if (!record) {
    return c.json({ success: false, error: "Record not found" }, 404);
  }

  let account: Record<string, unknown> | null = null;
  if (recordType === "contact" && record.accountId) {
    account = (await dbStore.accounts.findOne(
      record.accountId as string,
    )) as Record<string, unknown> | null;
  }

  const globalVars = await dbStore.marketingSequenceGlobalVariables.findMany();
  const globalVariablesMap: Record<string, string> = {};
  for (const v of globalVars) {
    globalVariablesMap[v.key] = v.value;
  }

  const recipientContext = {
    lead: recordType === "lead" ? record : null,
    contact: recordType === "contact" ? record : null,
    account,
    globalVariables: globalVariablesMap,
  };

  const compiled = compileEmailTemplate(
    { subject: subject || "", body: bodyText || "" },
    recipientContext,
  );

  return c.json({ success: true, data: compiled });
});

executionApp.post("/:id/schedule", tenantAuth, async (c) => {
  const sequenceId = c.req.param("id");
  const tenant = c.get("tenant");
  const body = await c.req.json().catch(() => ({}));
  const { sendingWindowStart, sendingWindowEnd, sendingDays, dailySendLimit } =
    body;

  const sequence = await dbStore.marketingSequences.findOne(sequenceId);
  if (!sequence || sequence.orgId !== tenant.orgId) {
    return c.json({ success: false, error: "Sequence not found" }, 404);
  }

  const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;
  if (
    sendingWindowStart !== undefined &&
    sendingWindowStart !== null &&
    !timeRegex.test(sendingWindowStart)
  ) {
    return c.json(
      { success: false, error: "sendingWindowStart must be in HH:MM format" },
      400,
    );
  }
  if (
    sendingWindowEnd !== undefined &&
    sendingWindowEnd !== null &&
    !timeRegex.test(sendingWindowEnd)
  ) {
    return c.json(
      { success: false, error: "sendingWindowEnd must be in HH:MM format" },
      400,
    );
  }

  if (sendingDays !== undefined && sendingDays !== null) {
    if (!Array.isArray(sendingDays)) {
      return c.json(
        { success: false, error: "sendingDays must be an array of numbers" },
        400,
      );
    }
    for (const d of sendingDays) {
      if (typeof d !== "number" || d < 1 || d > 7 || !Number.isInteger(d)) {
        return c.json(
          {
            success: false,
            error: "sendingDays values must be integers between 1 and 7",
          },
          400,
        );
      }
    }
  }

  let parsedLimit: number | null = sequence.dailySendLimit || null;
  if (dailySendLimit !== undefined) {
    if (dailySendLimit === null) {
      parsedLimit = null;
    } else {
      const num = Number(dailySendLimit);
      if (!Number.isInteger(num) || num <= 0) {
        return c.json(
          {
            success: false,
            error: "dailySendLimit must be a positive integer",
          },
          400,
        );
      }
      parsedLimit = num;
    }
  }

  const originalWindowStart = sequence.sendingWindowStart;
  const originalWindowEnd = sequence.sendingWindowEnd;
  const originalDays = sequence.sendingDays;
  const originalLimit = sequence.dailySendLimit;

  const updated = await dbStore.marketingSequences.update(sequenceId, {
    sendingWindowStart:
      sendingWindowStart !== undefined
        ? sendingWindowStart
        : originalWindowStart,
    sendingWindowEnd:
      sendingWindowEnd !== undefined ? sendingWindowEnd : originalWindowEnd,
    sendingDays: sendingDays !== undefined ? sendingDays : originalDays,
    dailySendLimit: dailySendLimit !== undefined ? parsedLimit : originalLimit,
  });

  await dbStore.auditLogs.insert({
    orgId: tenant.orgId,
    recordId: sequenceId,
    recordType: "marketing_sequences",
    action: "sequence_schedule_updated",
    userId: "00000000-0000-0000-0000-000000000000",
    changes: {
      sendingWindowStart: {
        before: originalWindowStart,
        after: sendingWindowStart,
      },
      sendingWindowEnd: { before: originalWindowEnd, after: sendingWindowEnd },
      sendingDays: { before: originalDays, after: sendingDays },
      dailySendLimit: { before: originalLimit, after: parsedLimit },
    },
  });

  return c.json({ success: true, data: updated });
});

executionApp.post("/email-event", tenantAuth, async (c) => {
  const tenant = c.get("tenant");
  const body = await c.req.json().catch(() => ({}));
  const { email, event, reason } = body;

  if (!email || !event) {
    return c.json(
      { success: false, error: "Email and event type are required" },
      400,
    );
  }

  if (event !== "bounce" && event !== "complaint") {
    return c.json(
      { success: false, error: "Event must be 'bounce' or 'complaint'" },
      400,
    );
  }

  const result = await handleEmailDeliveryEvent(dbStore, {
    orgId: tenant.orgId,
    email,
    event,
    reason,
  });

  return c.json({ success: true, data: result });
});

executionApp.get("/settings/caps", tenantAuth, async (c) => {
  const caps = await dbStore.marketingSequenceCaps.findMany();
  if (caps.length === 0) {
    return c.json({
      success: true,
      data: {
        domainThrottleLimit: 5,
        recipientFrequencyCap: 3,
      },
    });
  }
  return c.json({ success: true, data: caps[0] });
});

executionApp.post("/settings/caps", tenantAuth, async (c) => {
  const tenant = c.get("tenant");
  const body = await c.req.json().catch(() => ({}));
  const { domainThrottleLimit, recipientFrequencyCap } = body;

  if (domainThrottleLimit !== undefined) {
    const num = Number(domainThrottleLimit);
    if (!Number.isInteger(num) || num <= 0) {
      return c.json(
        {
          success: false,
          error: "domainThrottleLimit must be a positive integer",
        },
        400,
      );
    }
  }

  if (recipientFrequencyCap !== undefined) {
    const num = Number(recipientFrequencyCap);
    if (!Number.isInteger(num) || num <= 0) {
      return c.json(
        {
          success: false,
          error: "recipientFrequencyCap must be a positive integer",
        },
        400,
      );
    }
  }

  const existing = await dbStore.marketingSequenceCaps.findMany();
  if (existing.length > 0) {
    const updated = await dbStore.marketingSequenceCaps.update(existing[0].id, {
      domainThrottleLimit:
        domainThrottleLimit !== undefined
          ? Number(domainThrottleLimit)
          : existing[0].domainThrottleLimit,
      recipientFrequencyCap:
        recipientFrequencyCap !== undefined
          ? Number(recipientFrequencyCap)
          : existing[0].recipientFrequencyCap,
    });
    return c.json({ success: true, data: updated });
  }

  const created = await dbStore.marketingSequenceCaps.insert({
    orgId: tenant.orgId,
    domainThrottleLimit:
      domainThrottleLimit !== undefined ? Number(domainThrottleLimit) : 5,
    recipientFrequencyCap:
      recipientFrequencyCap !== undefined ? Number(recipientFrequencyCap) : 3,
  });
  return c.json({ success: true, data: created });
});

executionApp.post("/:id/triggers", tenantAuth, async (c) => {
  const sequenceId = c.req.param("id");
  const body = await c.req.json();
  const tenant = c.get("tenant");
  const orgId = tenant.orgId;

  const seq = await dbStore.marketingSequences.findOne(sequenceId);
  if (!seq) {
    return c.json({ success: false, error: "Sequence not found" }, 404);
  }

  const trigger = await dbStore.marketingSequenceScoreTriggers.insert({
    orgId,
    sequenceId,
    scoreThreshold: Number(body.scoreThreshold ?? 0),
    actionType: body.actionType,
    actionConfig: body.actionConfig || {},
  });

  return c.json({ success: true, data: trigger }, 201);
});

executionApp.get("/:id/triggers", tenantAuth, async (c) => {
  const sequenceId = c.req.param("id");
  const seq = await dbStore.marketingSequences.findOne(sequenceId);
  if (!seq) {
    return c.json({ success: false, error: "Sequence not found" }, 404);
  }

  const triggers =
    await dbStore.marketingSequenceScoreTriggers.findForSequence(sequenceId);
  return c.json({ success: true, data: triggers });
});

executionApp.delete("/triggers/:id", tenantAuth, async (c) => {
  const triggerId = c.req.param("id");
  const trigger =
    await dbStore.marketingSequenceScoreTriggers.findOne(triggerId);
  if (!trigger) {
    return c.json({ success: false, error: "Trigger not found" }, 404);
  }

  const success =
    await dbStore.marketingSequenceScoreTriggers.delete(triggerId);
  if (!success) {
    return c.json({ success: false, error: "Trigger not found" }, 404);
  }

  return c.json({
    success: true,
    message: "Score trigger deleted successfully",
  });
});
