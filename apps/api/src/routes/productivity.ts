import {
  calculateSurveyMetrics,
  processESignatureTransition,
  syncExternalItems,
  validateSurveyResponse,
} from "@crm/core";
import { dbStore } from "@crm/db";
import { globalFuzzySearch } from "@crm/search";
import { processOutboxItems } from "@crm/webhooks";
import { Hono } from "hono";
import { triggerOutboundWebhooks } from "../lib/webhooks";
import { type Env, tenantAuth } from "../middleware/tenantAuth";

export const productivityApp = new Hono<Env>();
export const consentApp = new Hono<Env>();
export const salesApp = new Hono<Env>();
export const activitiesApp = new Hono<Env>();
export const webhooksApp = new Hono<Env>();
export const searchApp = new Hono<Env>();
activitiesApp.post("/", tenantAuth, async (c) => {
  const tenant = c.get("tenant");
  const body = await c.req.json().catch(() => ({}));
  const { type, subject, body: noteBody, dueDate, links } = body;

  if (!type || !subject) {
    return c.json({ error: "Missing required activity parameters" }, 400);
  }

  const allowedTypes = ["task", "call", "note", "email"];
  if (!allowedTypes.includes(type)) {
    return c.json(
      { error: `Invalid activity type. Allowed: ${allowedTypes.join(", ")}` },
      400,
    );
  }

  const activity = await dbStore.activities.insert({
    orgId: tenant.orgId,
    creatorId: tenant.userId,
    type,
    subject,
    body: noteBody !== undefined ? noteBody : null,
    dueDate: dueDate ? new Date(dueDate) : null,
  });

  const insertedLinks = [];
  if (links && Array.isArray(links)) {
    const allowedTargetTypes = ["Account", "Contact", "Lead", "Opportunity"];
    for (const link of links) {
      const { targetType, targetId } = link;
      if (targetType && targetId && allowedTargetTypes.includes(targetType)) {
        const linkRecord = await dbStore.activityLinks.insert({
          orgId: tenant.orgId,
          activityId: activity.id,
          targetType,
          targetId,
        });
        insertedLinks.push(linkRecord);
      }
    }
  }

  return c.json({
    success: true,
    data: {
      ...activity,
      links: insertedLinks,
    },
  });
});

activitiesApp.get("/:id", tenantAuth, async (c) => {
  const id = c.req.param("id");
  const activity = await dbStore.activities.findOne(id);
  if (!activity) {
    return c.json({ error: "Activity not found" }, 404);
  }
  return c.json({ success: true, data: activity });
});

activitiesApp.get("/timeline/:targetType/:targetId", tenantAuth, async (c) => {
  const targetType = c.req.param("targetType");
  const targetId = c.req.param("targetId");

  const allowedTargetTypes = ["Account", "Contact", "Lead", "Opportunity"];
  if (!allowedTargetTypes.includes(targetType)) {
    return c.json(
      {
        error: `Invalid target type. Allowed: ${allowedTargetTypes.join(", ")}`,
      },
      400,
    );
  }

  const allLinks = await dbStore.activityLinks.findMany();
  const matchedLinks = allLinks.filter(
    (l) => l.targetType === targetType && l.targetId === targetId,
  );

  const matchedActivityIds = new Set(matchedLinks.map((l) => l.activityId));
  const activities = await dbStore.activities.findMany();
  const filteredActivities = activities.filter((act) =>
    matchedActivityIds.has(act.id),
  );

  filteredActivities.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  return c.json({ success: true, data: filteredActivities });
});
webhooksApp.post("/", tenantAuth, async (c) => {
  const tenant = c.get("tenant");
  const body = await c.req.json().catch(() => ({}));
  const { targetUrl, secret } = body;

  if (!targetUrl) {
    return c.json(
      { error: "Missing required webhook targetUrl parameter" },
      400,
    );
  }

  const webhook = await dbStore.webhooks.insert({
    orgId: tenant.orgId,
    targetUrl,
    secret: secret || null,
    status: "active",
  });

  return c.json({ success: true, data: webhook });
});

webhooksApp.get("/", tenantAuth, async (c) => {
  const webhooks = await dbStore.webhooks.findMany();
  return c.json({ success: true, data: webhooks });
});

webhooksApp.get("/deliveries", tenantAuth, async (c) => {
  const deliveries = await dbStore.webhookDeliveries.findMany();
  return c.json({ success: true, data: deliveries });
});

webhooksApp.get("/outbox", tenantAuth, async (c) => {
  const outbox = await dbStore.webhookOutbox.findMany();
  return c.json({ success: true, data: outbox });
});

webhooksApp.get("/dlq", tenantAuth, async (c) => {
  const dlq = await dbStore.webhookDlq.findMany();
  return c.json({ success: true, data: dlq });
});

webhooksApp.post("/process-outbox", tenantAuth, async (c) => {
  const tenant = c.get("tenant");
  const result = await processOutboxItems(tenant.orgId, dbStore);
  return c.json({ success: true, ...result });
});
searchApp.get("/", tenantAuth, async (c) => {
  const q = c.req.query("q") || "";
  const typesParam = c.req.query("types");
  const thresholdParam = c.req.query("threshold");

  const types = typesParam
    ? (typesParam.split(",") as (
        | "Lead"
        | "Account"
        | "Contact"
        | "Opportunity"
      )[])
    : undefined;

  const threshold = thresholdParam
    ? Number.parseFloat(thresholdParam)
    : undefined;

  const results = await globalFuzzySearch(q, {
    types,
    threshold,
    dbStore,
  });

  return c.json({ success: true, data: results });
});

searchApp.get("/fuzzy", tenantAuth, async (c) => {
  const q = c.req.query("q") || "";
  const typesParam = c.req.query("types");
  const thresholdParam = c.req.query("threshold");

  const types = typesParam
    ? (typesParam.split(",") as (
        | "Lead"
        | "Account"
        | "Contact"
        | "Opportunity"
      )[])
    : undefined;

  const threshold = thresholdParam
    ? Number.parseFloat(thresholdParam)
    : undefined;

  const results = await globalFuzzySearch(q, {
    types,
    threshold,
    dbStore,
  });

  return c.json({ success: true, data: results });
});
consentApp.get("/", tenantAuth, async (c) => {
  const _tenant = c.get("tenant");
  const recordType = c.req.query("recordType") as
    | "lead"
    | "contact"
    | undefined;
  const recordId = c.req.query("recordId");

  if (!recordType || !["lead", "contact"].includes(recordType)) {
    return c.json(
      {
        error: "Invalid or missing 'recordType' (must be 'lead' or 'contact')",
      },
      400,
    );
  }
  if (!recordId) {
    return c.json({ error: "Missing 'recordId' parameter" }, 400);
  }

  // Verify record exists in active tenant context
  if (recordType === "lead") {
    const lead = await dbStore.leads.findOne(recordId);
    if (!lead) return c.json({ error: "Lead not found" }, 404);
  } else {
    const contact = await dbStore.contacts.findOne(recordId);
    if (!contact) return c.json({ error: "Contact not found" }, 404);
  }

  const results = await dbStore.contactConsentPreferences.findMany(
    recordType,
    recordId,
  );
  return c.json({ success: true, data: results });
});

consentApp.post("/", tenantAuth, async (c) => {
  const tenant = c.get("tenant");
  const body = await c.req.json().catch(() => ({}));

  const recordType = body.recordType;
  const recordId = body.recordId;
  const channel = body.channel;
  const status = body.status;
  const source = body.source;

  if (!recordType || !["lead", "contact"].includes(recordType)) {
    return c.json(
      { error: "Invalid 'recordType' (must be 'lead' or 'contact')" },
      400,
    );
  }
  if (!recordId) {
    return c.json({ error: "Missing 'recordId'" }, 400);
  }
  if (!channel || !["email", "sms", "phone"].includes(channel)) {
    return c.json(
      { error: "Invalid 'channel' (must be 'email', 'sms', or 'phone')" },
      400,
    );
  }
  if (!status || !["opt_in", "opt_out", "pending"].includes(status)) {
    return c.json(
      { error: "Invalid 'status' (must be 'opt_in', 'opt_out', or 'pending')" },
      400,
    );
  }
  if (!source || typeof source !== "string" || source.trim() === "") {
    return c.json({ error: "Missing or invalid 'source'" }, 400);
  }

  // Verify record exists in active tenant context
  if (recordType === "lead") {
    const lead = await dbStore.leads.findOne(recordId);
    if (!lead) return c.json({ error: "Lead not found" }, 404);
  } else {
    const contact = await dbStore.contacts.findOne(recordId);
    if (!contact) return c.json({ error: "Contact not found" }, 404);
  }

  const upserted = await dbStore.contactConsentPreferences.upsert({
    orgId: tenant.orgId,
    recordType,
    recordId,
    channel,
    status,
    source,
    updatedById: tenant.userId,
  });

  await dbStore.auditLogs.insert({
    orgId: tenant.orgId,
    recordId: upserted.id,
    recordType: "contact_consent_preferences",
    action: "upsert",
    userId: tenant.userId,
    changes: { consent: { before: null, after: upserted } },
  });

  await triggerOutboundWebhooks(
    tenant.orgId,
    "contact_consent_preference.updated",
    {
      consentId: upserted.id,
      recordType,
      recordId,
      channel,
      status,
    },
  );

  return c.json({ success: true, data: upserted });
});
productivityApp.get("/sync/settings", tenantAuth, async (c) => {
  const tenant = c.get("tenant");
  const settings = await dbStore.emailCalendarSyncSettings.findByUser(
    tenant.userId,
  );
  return c.json({ success: true, data: settings });
});

productivityApp.post("/sync/settings", tenantAuth, async (c) => {
  const tenant = c.get("tenant");
  const body = await c.req.json().catch(() => ({}));
  const { provider, isActive, syncEmails, syncCalendar } = body;

  if (!provider) {
    return c.json({ error: "Missing 'provider'" }, 400);
  }

  const existing = await dbStore.emailCalendarSyncSettings.findByUser(
    tenant.userId,
  );
  if (existing) {
    const updated = await dbStore.emailCalendarSyncSettings.update(
      existing.id,
      {
        provider,
        isActive:
          isActive !== undefined ? Boolean(isActive) : existing.isActive,
        syncEmails:
          syncEmails !== undefined ? Boolean(syncEmails) : existing.syncEmails,
        syncCalendar:
          syncCalendar !== undefined
            ? Boolean(syncCalendar)
            : existing.syncCalendar,
      },
    );
    return c.json({ success: true, data: updated });
  }

  const inserted = await dbStore.emailCalendarSyncSettings.insert({
    orgId: tenant.orgId,
    userId: tenant.userId,
    provider,
    isActive: isActive !== undefined ? Boolean(isActive) : true,
    syncEmails: syncEmails !== undefined ? Boolean(syncEmails) : true,
    syncCalendar: syncCalendar !== undefined ? Boolean(syncCalendar) : true,
    lastSyncedAt: null,
  });

  return c.json({ success: true, data: inserted });
});

productivityApp.post("/sync/trigger", tenantAuth, async (c) => {
  const tenant = c.get("tenant");
  const body = await c.req.json().catch(() => ({}));
  const mockEmails = body.emails || [];
  const mockEvents = body.events || [];

  const settings = await dbStore.emailCalendarSyncSettings.findByUser(
    tenant.userId,
  );
  if (!settings?.isActive) {
    return c.json({ error: "No active sync settings found for user" }, 400);
  }

  const startedAt = new Date();

  // Retrieve leads and contacts under RLS context
  const leads = await dbStore.leads.findMany();
  const contacts = await dbStore.contacts.findMany();

  // Retrieve existing activities and extract their externalIds from custom metadata
  const activities = await dbStore.activities.findMany();
  const existingExternalIds = activities
    .map((a) => (a.custom as Record<string, unknown> | null)?.externalId)
    .filter((id): id is string => typeof id === "string");

  // Call pure sync calculator
  const syncResult = syncExternalItems({
    settings: {
      syncEmails: settings.syncEmails,
      syncCalendar: settings.syncCalendar,
    },
    externalEmails: mockEmails,
    externalCalendarEvents: mockEvents,
    existingLeads: leads.map((l) => ({ id: l.id, email: l.email })),
    existingContacts: contacts.map((co) => ({ id: co.id, email: co.email })),
    existingActivityExternalIds: existingExternalIds,
  });

  let emailsSyncedCount = 0;
  let eventsSyncedCount = 0;

  // Insert synced emails as activities and create activity links
  for (const syncedEmail of syncResult.syncedEmails) {
    const act = await dbStore.activities.insert({
      orgId: tenant.orgId,
      creatorId: tenant.userId,
      type: "email",
      subject: syncedEmail.subject,
      body: syncedEmail.body,
      dueDate: null,
      createdAt: new Date(syncedEmail.receivedAt),
      custom: { externalId: syncedEmail.externalId },
    });

    await dbStore.activityLinks.insert({
      orgId: tenant.orgId,
      activityId: act.id,
      targetType: syncedEmail.targetType,
      targetId: syncedEmail.targetId,
    });
    emailsSyncedCount++;
  }

  // Insert synced calendar events as activities (meetings / tasks) and create links
  for (const syncedEvent of syncResult.syncedEvents) {
    const act = await dbStore.activities.insert({
      orgId: tenant.orgId,
      creatorId: tenant.userId,
      type: "task",
      subject: `Meeting: ${syncedEvent.title}`,
      body: syncedEvent.description,
      dueDate: new Date(syncedEvent.eventDate),
      createdAt: new Date(),
      custom: { externalId: syncedEvent.externalId },
    });

    await dbStore.activityLinks.insert({
      orgId: tenant.orgId,
      activityId: act.id,
      targetType: syncedEvent.targetType,
      targetId: syncedEvent.targetId,
    });
    eventsSyncedCount++;
  }

  const completedAt = new Date();

  // Log sync run in history
  const runLog = await dbStore.emailCalendarSyncRuns.insert({
    orgId: tenant.orgId,
    settingsId: settings.id,
    status: "success",
    emailsSyncedCount,
    eventsSyncedCount,
    errorMessage: null,
    startedAt,
    completedAt,
  });

  // Update lastSyncedAt on settings
  await dbStore.emailCalendarSyncSettings.update(settings.id, {
    lastSyncedAt: completedAt,
  });

  // Log audit logs
  await dbStore.auditLogs.insert({
    orgId: tenant.orgId,
    recordId: runLog.id,
    recordType: "email_calendar_sync_runs",
    action: "sync",
    userId: tenant.userId,
    changes: {
      emailsSyncedCount: { before: null, after: emailsSyncedCount },
      eventsSyncedCount: { before: null, after: eventsSyncedCount },
    },
  });

  // Trigger webhooks
  await triggerOutboundWebhooks(tenant.orgId, "productivity.sync_completed", {
    runId: runLog.id,
    emailsSyncedCount,
    eventsSyncedCount,
  });

  return c.json({ success: true, data: runLog });
});

productivityApp.get("/sync/runs", tenantAuth, async (c) => {
  const runs = await dbStore.emailCalendarSyncRuns.findMany();
  return c.json({ success: true, data: runs });
});
salesApp.post("/esignature/requests", tenantAuth, async (c) => {
  const tenant = c.get("tenant");
  const body = await c.req.json().catch(() => ({}));
  const { documentName, signerEmail, opportunityId, contractId } = body;

  if (!documentName || !signerEmail) {
    return c.json({ error: "Missing 'documentName' or 'signerEmail'" }, 400);
  }

  if (!signerEmail.includes("@")) {
    return c.json({ error: "Invalid signer email" }, 400);
  }

  if (!opportunityId && !contractId) {
    return c.json(
      {
        error:
          "E-Signature request must be linked to an Opportunity or Contract",
      },
      400,
    );
  }

  const newReq = await dbStore.esignatureRequests.insert({
    orgId: tenant.orgId,
    documentName,
    signerEmail,
    status: "sent",
    opportunityId: opportunityId || null,
    contractId: contractId || null,
  });

  await dbStore.auditLogs.insert({
    orgId: tenant.orgId,
    recordId: newReq.id,
    recordType: "esignature_requests",
    action: "create",
    userId: tenant.userId,
    changes: {
      documentName: { before: null, after: documentName },
      signerEmail: { before: null, after: signerEmail },
      status: { before: null, after: "sent" },
    },
  });

  return c.json({ success: true, data: newReq });
});

salesApp.get("/esignature/requests", tenantAuth, async (c) => {
  const requests = await dbStore.esignatureRequests.findMany();
  return c.json({ success: true, data: requests });
});

salesApp.post("/esignature/simulate", tenantAuth, async (c) => {
  const tenant = c.get("tenant");
  const body = await c.req.json().catch(() => ({}));
  const { requestId, action } = body;

  if (!requestId || !action) {
    return c.json({ error: "Missing 'requestId' or 'action'" }, 400);
  }

  const existing = await dbStore.esignatureRequests.findOne(requestId);
  if (!existing) {
    return c.json({ error: "E-Signature request not found" }, 404);
  }

  try {
    const transitionResult = processESignatureTransition({
      currentStatus: existing.status,
      action: action as "view" | "sign" | "decline",
    });

    const completedAt = transitionResult.isCompleted ? new Date() : null;

    const updated = await dbStore.esignatureRequests.update(requestId, {
      status: transitionResult.nextStatus,
      completedAt,
    });

    await dbStore.auditLogs.insert({
      orgId: tenant.orgId,
      recordId: existing.id,
      recordType: "esignature_requests",
      action: "simulate_transition",
      userId: tenant.userId,
      changes: {
        status: { before: existing.status, after: transitionResult.nextStatus },
      },
    });

    await triggerOutboundWebhooks(tenant.orgId, "sales.esignature_updated", {
      requestId: existing.id,
      status: transitionResult.nextStatus,
    });

    return c.json({ success: true, data: updated });
  } catch (error) {
    const err = error as Error;
    return c.json({ error: err.message }, 400);
  }
});

salesApp.post("/surveys", tenantAuth, async (c) => {
  const tenant = c.get("tenant");
  const body = await c.req.json().catch(() => ({}));
  const { name, type, status } = body;

  if (!name || !type) {
    return c.json({ error: "Missing required fields: 'name' or 'type'" }, 400);
  }

  if (type !== "csat" && type !== "nps") {
    return c.json(
      { error: "Invalid survey type. Must be 'csat' or 'nps'" },
      400,
    );
  }

  const surveyStatus = status || "draft";
  if (
    surveyStatus !== "draft" &&
    surveyStatus !== "active" &&
    surveyStatus !== "closed"
  ) {
    return c.json(
      {
        error: "Invalid survey status. Must be 'draft', 'active', or 'closed'",
      },
      400,
    );
  }

  const newSurvey = await dbStore.surveys.insert({
    orgId: tenant.orgId,
    name,
    type: type as "csat" | "nps",
    status: surveyStatus as "draft" | "active" | "closed",
  });

  await dbStore.auditLogs.insert({
    orgId: tenant.orgId,
    recordId: newSurvey.id,
    recordType: "surveys",
    action: "create",
    userId: tenant.userId,
    changes: {
      name: { before: null, after: name },
      type: { before: null, after: type },
      status: { before: null, after: surveyStatus },
    },
  });

  return c.json({ success: true, data: newSurvey });
});

salesApp.get("/surveys", tenantAuth, async (c) => {
  const surveys = await dbStore.surveys.findMany();
  return c.json({ success: true, data: surveys });
});

salesApp.post("/surveys/responses", tenantAuth, async (c) => {
  const tenant = c.get("tenant");
  const body = await c.req.json().catch(() => ({}));
  const { surveyId, contactId, score, comment } = body;

  if (!surveyId || score === undefined) {
    return c.json(
      { error: "Missing required fields: 'surveyId' or 'score'" },
      400,
    );
  }

  const survey = await dbStore.surveys.findOne(surveyId);
  if (!survey) {
    return c.json({ error: "Survey not found" }, 404);
  }

  if (survey.status !== "active") {
    return c.json(
      { error: "Survey is not active and cannot accept responses" },
      400,
    );
  }

  const validation = validateSurveyResponse(score, survey.type);
  if (!validation.isValid) {
    return c.json({ error: validation.error }, 400);
  }

  const response = await dbStore.surveyResponses.insert({
    orgId: tenant.orgId,
    surveyId,
    contactId: contactId || null,
    score,
    comment: comment || null,
  });

  await dbStore.auditLogs.insert({
    orgId: tenant.orgId,
    recordId: response.id,
    recordType: "survey_responses",
    action: "create",
    userId: tenant.userId,
    changes: {
      surveyId: { before: null, after: surveyId },
      score: { before: null, after: score },
    },
  });

  await triggerOutboundWebhooks(tenant.orgId, "sales.survey_response_created", {
    responseId: response.id,
    surveyId,
    score,
  });

  return c.json({ success: true, data: response });
});

salesApp.get("/surveys/:id/metrics", tenantAuth, async (c) => {
  const id = c.req.param("id");
  const survey = await dbStore.surveys.findOne(id);
  if (!survey) {
    return c.json({ error: "Survey not found" }, 404);
  }

  const responses = await dbStore.surveyResponses.findBySurvey(id);
  const metrics = calculateSurveyMetrics(responses, survey.type);

  return c.json({ success: true, data: metrics });
});
