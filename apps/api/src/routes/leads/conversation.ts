import { ConversationalBotService } from "@crm/core";
import { dbStore } from "@crm/db";
import { OpenAPIHono } from "@hono/zod-openapi";
import { type Env, tenantAuth } from "../../middleware/tenantAuth";

export const conversationRouter = new OpenAPIHono<Env>();

conversationRouter.use(tenantAuth);

// 1. Simulate inbound message endpoint
conversationRouter.post("/:id/conversation/simulate", tenantAuth, async (c) => {
  const id = c.req.param("id");
  const tenant = c.get("tenant");
  const body = await c.req.json().catch(() => ({}));
  const { message, type } = body;

  if (!message) {
    return c.json({ error: "Missing message body to simulate." }, 400);
  }

  const allowedTypes = ["email", "sms"];
  const messageType = type && allowedTypes.includes(type) ? type : "email";

  // Validate lead exists
  const lead = await dbStore.leads.findOne(id);
  if (!lead) {
    return c.json({ error: `Lead not found with ID ${id}` }, 404);
  }

  // Create simulated inbound activity
  const inboundActivity = await dbStore.activities.insert({
    orgId: tenant.orgId,
    creatorId: "lead", // mark as lead sent
    type: messageType,
    subject:
      messageType === "sms" ? "Inbound SMS text" : "Inbound email message",
    body: message,
    dueDate: null,
  });

  // Create link linking inbound activity to lead
  await dbStore.activityLinks.insert({
    orgId: tenant.orgId,
    activityId: inboundActivity.id,
    targetType: "Lead",
    targetId: id,
  });

  // Run qualification bot synchronously for immediate, reliable API feedback
  const updatedLead = await ConversationalBotService.qualifyLead(
    id,
    tenant.orgId,
  );

  return c.json({
    success: true,
    data: updatedLead,
  });
});

// 2. Get conversational bot qualification status
conversationRouter.get("/:id/conversation/status", tenantAuth, async (c) => {
  const id = c.req.param("id");

  // Validate lead exists
  const lead = await dbStore.leads.findOne(id);
  if (!lead) {
    return c.json({ error: `Lead not found with ID ${id}` }, 404);
  }

  // Fetch all activity links linked to the lead
  const allLinks = await dbStore.activityLinks.findMany();
  const leadLinks = allLinks.filter(
    (link) => link.targetType === "Lead" && link.targetId === id,
  );

  // Fetch all linked activities
  const activities: any[] = [];
  for (const link of leadLinks) {
    const activity = await dbStore.activities.findOne(link.activityId);
    if (activity) {
      activities.push(activity);
    }
  }

  // Sort chronologically
  activities.sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );

  const custom = lead.custom || {};

  return c.json({
    success: true,
    data: {
      bantBudget: custom.bantBudget || "unknown",
      bantAuthority: custom.bantAuthority || "unknown",
      bantNeed: custom.bantNeed || "unknown",
      bantTimeline: custom.bantTimeline || "unknown",
      bantScore: custom.bantScore || 0,
      botQualificationStatus:
        custom.botQualificationStatus || "needs_more_info",
      botNextQuery: custom.botNextQuery || null,
      botNotes: custom.botNotes || "",
      history: activities.map((act) => ({
        id: act.id,
        type: act.type,
        subject: act.subject,
        body: act.body,
        sender: act.creatorId === "lead" ? "Lead" : "Bot",
        createdAt: act.createdAt,
      })),
    },
  });
});
