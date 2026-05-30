import {
  calculateAgentCSATMetrics,
  validateCSATFeedbackInput,
} from "@crm/core";
import { dbStore } from "@crm/db";
import { Hono } from "hono";
import { type Env, tenantAuth } from "../../middleware/tenantAuth";

export const feedbackRouter = new Hono<Env>();

feedbackRouter.post("/tickets/:id/feedback", tenantAuth, async (c) => {
  const tenant = c.get("tenant");
  const ticketId = c.req.param("id");
  const body = await c.req.json();

  const validation = validateCSATFeedbackInput(body);
  if (!validation.success) {
    return c.json({ error: validation.error }, 400);
  }

  const ticket = await dbStore.tickets.findOne(ticketId);
  if (!ticket) {
    return c.json({ error: "Ticket not found" }, 404);
  }

  if (ticket.orgId !== tenant.orgId) {
    return c.json({ error: "RLS Isolation Violation: Tenant mismatch." }, 403);
  }

  let surveyId = body.surveyId;
  if (!surveyId) {
    const surveys = await dbStore.surveys.findMany();
    let survey = surveys.find(
      (s) => s.type === "csat" && s.status === "active",
    );
    if (!survey) {
      survey = await dbStore.surveys.insert({
        orgId: tenant.orgId,
        name: "Default Ticket CSAT Survey",
        type: "csat",
        status: "active",
      });
    }
    surveyId = survey.id;
  }

  const newResponse = await dbStore.surveyResponses.insert({
    orgId: tenant.orgId,
    surveyId: surveyId,
    contactId: ticket.contactId || null,
    ticketId: ticketId,
    score: body.score,
    comment: body.comment || null,
  });

  let updatedTicket = ticket;
  if (ticket.status !== "Resolved") {
    const res = await dbStore.tickets.update(ticketId, {
      status: "Resolved",
    });
    if (res) {
      updatedTicket = res;
    }
  }

  await dbStore.auditLogs.insert({
    orgId: tenant.orgId,
    recordId: ticketId,
    recordType: "Ticket",
    action: "submit_feedback",
    userId: tenant.userId,
    changes: {
      score: { before: null, after: body.score },
      comment: { before: null, after: body.comment || null },
      statusTransitioned: {
        before: ticket.status,
        after: updatedTicket.status,
      },
    },
  });

  return c.json({ success: true, data: newResponse, ticket: updatedTicket });
});

feedbackRouter.get("/tickets/:id/feedback", tenantAuth, async (c) => {
  const tenant = c.get("tenant");
  const ticketId = c.req.param("id");

  const ticket = await dbStore.tickets.findOne(ticketId);
  if (!ticket) {
    return c.json({ error: "Ticket not found" }, 404);
  }

  if (ticket.orgId !== tenant.orgId) {
    return c.json({ error: "RLS Isolation Violation: Tenant mismatch." }, 403);
  }

  const responses = await dbStore.surveyResponses.findByTicket(ticketId);
  return c.json({ success: true, data: responses });
});

feedbackRouter.get("/agents/:id/metrics", tenantAuth, async (c) => {
  const _tenant = c.get("tenant");
  const agentId = c.req.param("id");

  const allTickets = await dbStore.tickets.findMany();
  const agentTickets = allTickets.filter((t) => t.assignedToId === agentId);

  const allResponses = await dbStore.surveyResponses.findMany();
  const allMilestones = await dbStore.ticketMilestones.findMany();

  const ticketsWithResolvedAt = agentTickets.map((t) => {
    const ms = allMilestones.find(
      (m) =>
        m.ticketId === t.id &&
        m.milestoneType === "resolution" &&
        m.status === "completed",
    );
    return {
      id: t.id,
      assignedToId: t.assignedToId || null,
      status: t.status,
      createdAt: t.createdAt,
      resolvedAt: ms
        ? ms.completedAt
        : t.status === "Resolved"
          ? new Date()
          : null,
    };
  });

  const metrics = calculateAgentCSATMetrics({
    agentId,
    tickets: ticketsWithResolvedAt,
    responses: allResponses.map((r) => ({
      ticketId: r.ticketId ?? null,
      score: r.score,
    })),
  });

  return c.json({ success: true, data: metrics });
});
