import {
  calculateMilestoneDueDate,
  evaluateMilestoneCompletion,
  evaluateTicketEscalation,
} from "@crm/core";
import { dbStore } from "@crm/db";
import { Hono } from "hono";
import { triggerOutboundWebhooks } from "../../lib/webhooks";
import { type Env, tenantAuth } from "../../middleware/tenantAuth";

export const slaRouter = new Hono<Env>();

slaRouter.post("/sla-policies", tenantAuth, async (c) => {
  const tenant = c.get("tenant");
  const body = await c.req.json().catch(() => ({}));
  const {
    name,
    priority,
    responseTimeLimitMinutes,
    resolutionTimeLimitMinutes,
  } = body;

  if (
    !name ||
    !priority ||
    responseTimeLimitMinutes === undefined ||
    resolutionTimeLimitMinutes === undefined
  ) {
    return c.json(
      {
        error:
          "Missing required fields: 'name', 'priority', 'responseTimeLimitMinutes', or 'resolutionTimeLimitMinutes'",
      },
      400,
    );
  }

  if (priority !== "high" && priority !== "medium" && priority !== "low") {
    return c.json(
      { error: "Invalid priority. Must be 'high', 'medium', or 'low'" },
      400,
    );
  }

  const newPolicy = await dbStore.slaPolicies.insert({
    orgId: tenant.orgId,
    name,
    priority: priority as "high" | "medium" | "low",
    responseTimeLimitMinutes: Number(responseTimeLimitMinutes),
    resolutionTimeLimitMinutes: Number(resolutionTimeLimitMinutes),
    isActive: true,
  });

  await dbStore.auditLogs.insert({
    orgId: tenant.orgId,
    recordId: newPolicy.id,
    recordType: "sla_policies",
    action: "create",
    userId: tenant.userId,
    changes: {
      name: { before: null, after: name },
      priority: { before: null, after: priority },
    },
  });

  return c.json({ success: true, data: newPolicy }, 201);
});

slaRouter.get("/sla-policies", tenantAuth, async (c) => {
  const policies = await dbStore.slaPolicies.findMany();
  return c.json({ success: true, data: policies });
});

slaRouter.post("/tickets/:id/milestones", tenantAuth, async (c) => {
  const tenant = c.get("tenant");
  const ticketId = c.req.param("id");
  const body = await c.req.json().catch(() => ({}));
  const { priority } = body;

  if (!priority) {
    return c.json({ error: "Missing required field: 'priority'" }, 400);
  }

  if (priority !== "high" && priority !== "medium" && priority !== "low") {
    return c.json(
      { error: "Invalid priority. Must be 'high', 'medium', or 'low'" },
      400,
    );
  }

  const ticket = await dbStore.tickets.findOne(ticketId);
  if (!ticket) {
    return c.json({ error: "Ticket not found" }, 404);
  }

  // Overwrite check
  const existing = await dbStore.ticketMilestones.findByTicket(ticketId);
  if (existing.length > 0) {
    return c.json(
      { error: "Ticket is already enrolled in an SLA policy" },
      400,
    );
  }

  const policies = await dbStore.slaPolicies.findMany();
  const matchedPolicy = policies.find(
    (p) => p.priority === priority && p.isActive,
  );

  if (!matchedPolicy) {
    return c.json(
      { error: `No active SLA Policy found for priority '${priority}'` },
      400,
    );
  }

  const firstResponseDueDate = calculateMilestoneDueDate(
    ticket.createdAt,
    matchedPolicy.responseTimeLimitMinutes,
  );
  const resolutionDueDate = calculateMilestoneDueDate(
    ticket.createdAt,
    matchedPolicy.resolutionTimeLimitMinutes,
  );

  const m1 = await dbStore.ticketMilestones.insert({
    orgId: tenant.orgId,
    ticketId,
    milestoneType: "first_response",
    targetTime: firstResponseDueDate,
    completedAt: null,
    status: "pending",
    isMet: null,
  });

  const m2 = await dbStore.ticketMilestones.insert({
    orgId: tenant.orgId,
    ticketId,
    milestoneType: "resolution",
    targetTime: resolutionDueDate,
    completedAt: null,
    status: "pending",
    isMet: null,
  });

  return c.json({ success: true, data: [m1, m2] }, 201);
});

slaRouter.get("/tickets/:id/milestones", tenantAuth, async (c) => {
  const ticketId = c.req.param("id");
  const ticket = await dbStore.tickets.findOne(ticketId);
  if (!ticket) {
    return c.json({ error: "Ticket not found" }, 404);
  }

  const milestones = await dbStore.ticketMilestones.findByTicket(ticketId);
  return c.json({ success: true, data: milestones });
});

slaRouter.put("/tickets/:id/milestones/:milestoneId", tenantAuth, async (c) => {
  const tenant = c.get("tenant");
  const { milestoneId } = c.req.param();
  const body = await c.req.json().catch(() => ({}));
  const { action } = body;

  if (action !== "complete") {
    return c.json(
      { error: "Invalid action. Supported action: 'complete'" },
      400,
    );
  }

  const milestone = await dbStore.ticketMilestones.findOne(milestoneId);
  if (!milestone) {
    return c.json({ error: "Milestone not found" }, 404);
  }

  if (milestone.status !== "pending") {
    return c.json({ error: "Milestone is already completed or breached" }, 400);
  }

  const now = new Date();
  const evaluation = evaluateMilestoneCompletion(milestone.targetTime, now);

  const updated = await dbStore.ticketMilestones.update(milestoneId, {
    completedAt: now,
    status: evaluation.status,
    isMet: evaluation.isMet,
  });

  await dbStore.auditLogs.insert({
    orgId: tenant.orgId,
    recordId: milestoneId,
    recordType: "ticket_milestones",
    action: "update",
    userId: tenant.userId,
    changes: {
      status: { before: "pending", after: evaluation.status },
      isMet: { before: null, after: evaluation.isMet },
    },
  });

  await triggerOutboundWebhooks(tenant.orgId, "service.milestone_updated", {
    milestoneId,
    ticketId: milestone.ticketId,
    status: evaluation.status,
    isMet: evaluation.isMet,
  });

  return c.json({ success: true, data: updated });
});

slaRouter.post("/tickets/escalation-rules", tenantAuth, async (c) => {
  const tenant = c.get("tenant");
  const body = await c.req.json().catch(() => ({}));
  const {
    name,
    triggerType,
    timeThresholdMinutes,
    escalateToId,
    newPriority,
    isActive,
  } = body;

  if (!name || !triggerType || !escalateToId) {
    return c.json(
      { error: "Missing required escalation rule parameters" },
      400,
    );
  }

  const activeVal = isActive !== undefined ? Number(isActive) : 1;

  const newRule = await dbStore.ticketEscalationRules.insert({
    orgId: tenant.orgId,
    name,
    triggerType,
    timeThresholdMinutes:
      timeThresholdMinutes !== undefined ? Number(timeThresholdMinutes) : 0,
    escalateToId,
    newPriority: newPriority || null,
    isActive: activeVal,
  });

  await dbStore.auditLogs.insert({
    orgId: tenant.orgId,
    recordId: newRule.id,
    recordType: "ticket_escalation_rules",
    action: "create",
    userId: tenant.userId,
    changes: null,
  });

  return c.json({ success: true, data: newRule }, 201);
});

slaRouter.get("/tickets/escalation-rules", tenantAuth, async (c) => {
  const rules = await dbStore.ticketEscalationRules.findMany();
  return c.json({ success: true, data: rules });
});

slaRouter.post("/tickets/:id/escalate", tenantAuth, async (c) => {
  const tenant = c.get("tenant");
  const ticketId = c.req.param("id");

  const ticket = await dbStore.tickets.findOne(ticketId);
  if (!ticket) {
    return c.json({ error: "Ticket not found" }, 404);
  }

  const rules = await dbStore.ticketEscalationRules.findMany();
  const activeRules = rules.filter((r) => r.isActive === 1);

  const allMilestones = await dbStore.ticketMilestones.findMany();
  const milestones = allMilestones.filter((m) => m.ticketId === ticketId);

  const coreMilestones = milestones.map((m) => ({
    id: m.id,
    milestoneType: m.milestoneType,
    targetTime: new Date(m.targetTime),
    status: m.status,
    completedAt: m.completedAt ? new Date(m.completedAt) : null,
  }));

  const coreRules = activeRules.map((r) => ({
    id: r.id,
    name: r.name,
    triggerType: r.triggerType,
    timeThresholdMinutes: r.timeThresholdMinutes,
    escalateToId: r.escalateToId,
    newPriority: r.newPriority,
    isActive: r.isActive,
  }));

  const escalationResult = evaluateTicketEscalation(
    {
      priority: ticket.priority || "Medium",
      assignedToId: ticket.assignedToId || null,
    },
    coreMilestones,
    coreRules,
  );

  if (!escalationResult) {
    return c.json({ success: true, escalated: false, data: ticket });
  }

  const previousAssignedToId = ticket.assignedToId || null;
  const previousPriority = ticket.priority || "Medium";
  const newPriority = escalationResult.newPriority || previousPriority;

  const updatedTicket = await dbStore.tickets.update(ticketId, {
    assignedToId: escalationResult.escalateToId,
    priority: newPriority,
  });

  const newEscalation = await dbStore.ticketEscalations.insert({
    orgId: tenant.orgId,
    ticketId,
    ruleId: escalationResult.ruleId,
    previousAssignedToId,
    escalatedToId: escalationResult.escalateToId,
    previousPriority,
    newPriority,
    reason: escalationResult.reason,
  });

  await dbStore.auditLogs.insert({
    orgId: tenant.orgId,
    recordId: ticketId,
    recordType: "Ticket",
    action: "escalate",
    userId: tenant.userId,
    changes: {
      assignedToId: {
        before: previousAssignedToId,
        after: escalationResult.escalateToId,
      },
      priority: { before: previousPriority, after: newPriority },
    },
  });

  return c.json({
    success: true,
    escalated: true,
    data: updatedTicket,
    escalation: newEscalation,
  });
});

slaRouter.get("/tickets/:id/escalations", tenantAuth, async (c) => {
  const ticketId = c.req.param("id");

  const ticket = await dbStore.tickets.findOne(ticketId);
  if (!ticket) {
    return c.json({ error: "Ticket not found" }, 404);
  }

  const escalations = await dbStore.ticketEscalations.findMany();
  const ticketEscalationsList = escalations.filter(
    (e) => e.ticketId === ticketId,
  );

  return c.json({ success: true, data: ticketEscalationsList });
});
