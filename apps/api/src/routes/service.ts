import {
  applyTicketMacro,
  calculateAgentCSATMetrics,
  calculateMilestoneDueDate,
  evaluateMilestoneCompletion,
  evaluateTicketAssignment,
  evaluateTicketEscalation,
  incrementArticleViewCount,
  validateArticleStatus,
  validateCSATFeedbackInput,
  validateTicketCommentInput,
  validateTicketMacroInput,
  validateTicketTagInput,
} from "@crm/core";
import { dbStore } from "@crm/db";
import { Hono } from "hono";
import { triggerOutboundWebhooks } from "../lib/webhooks";
import { type Env, tenantAuth } from "../middleware/tenantAuth";

/**
 * Service tickets sub-resource: routing rules CRUD + manual + auto-routed
 * assignment. Mounted at /api/service.
 */
export const serviceApp = new Hono<Env>();

serviceApp.post("/tickets/routing-rules", tenantAuth, async (c) => {
  const tenant = c.get("tenant");
  const body = await c.req.json().catch(() => ({}));
  const { name, isActive } = body;

  if (!name) {
    return c.json({ error: "Missing required routing rule name" }, 400);
  }

  const activeVal = isActive !== undefined ? Number(isActive) : 0;

  if (activeVal === 1) {
    const allRules = await dbStore.ticketAssignmentRules.findMany();
    for (const r of allRules) {
      if (r.isActive === 1) {
        await dbStore.ticketAssignmentRules.update(r.id, { isActive: 0 });
      }
    }
  }

  const newRule = await dbStore.ticketAssignmentRules.insert({
    orgId: tenant.orgId,
    name,
    isActive: activeVal,
  });

  await dbStore.auditLogs.insert({
    orgId: tenant.orgId,
    recordId: newRule.id,
    recordType: "ticket_assignment_rules",
    action: "create",
    userId: tenant.userId,
    changes: null,
  });

  return c.json({ success: true, data: newRule }, 201);
});

serviceApp.get("/tickets/routing-rules", tenantAuth, async (c) => {
  const rules = await dbStore.ticketAssignmentRules.findMany();
  return c.json({ success: true, data: rules });
});

serviceApp.post("/tickets/routing-rules/:id/entries", tenantAuth, async (c) => {
  const tenant = c.get("tenant");
  const ruleId = c.req.param("id");
  const rule = await dbStore.ticketAssignmentRules.findOne(ruleId);
  if (!rule) {
    return c.json({ error: "Routing rule not found" }, 404);
  }

  const body = await c.req.json().catch(() => ({}));
  const { sortOrder, routingMethod, routingUserIds, criteria } = body;

  if (
    sortOrder === undefined ||
    !routingMethod ||
    !routingUserIds ||
    !criteria
  ) {
    return c.json({ error: "Missing required rule entry parameters" }, 400);
  }

  const entry = await dbStore.ticketAssignmentRuleEntries.insert({
    orgId: tenant.orgId,
    ruleId,
    sortOrder: Number(sortOrder),
    routingMethod,
    routingUserIds,
    lastAssignedIndex: -1,
    criteria,
  });

  await dbStore.auditLogs.insert({
    orgId: tenant.orgId,
    recordId: entry.id,
    recordType: "ticket_assignment_rule_entries",
    action: "create",
    userId: tenant.userId,
    changes: null,
  });

  return c.json({ success: true, data: entry }, 201);
});

serviceApp.get("/tickets/routing-rules/:id/entries", tenantAuth, async (c) => {
  const ruleId = c.req.param("id");
  const rule = await dbStore.ticketAssignmentRules.findOne(ruleId);
  if (!rule) {
    return c.json({ error: "Routing rule not found" }, 404);
  }

  const allEntries = await dbStore.ticketAssignmentRuleEntries.findMany();
  const ruleEntries = allEntries
    .filter((e) => e.ruleId === ruleId)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  return c.json({ success: true, data: ruleEntries });
});

serviceApp.post("/tickets/:id/route", tenantAuth, async (c) => {
  const tenant = c.get("tenant");
  const id = c.req.param("id");
  const ticket = await dbStore.tickets.findOne(id);
  if (!ticket) {
    return c.json({ error: "Ticket not found" }, 404);
  }

  const rules = await dbStore.ticketAssignmentRules.findMany();
  const activeRule = rules.find((r) => r.isActive === 1);
  if (!activeRule) {
    return c.json({ error: "No active ticket assignment rule found" }, 400);
  }

  const allEntries = await dbStore.ticketAssignmentRuleEntries.findMany();
  const activeEntries = allEntries
    .filter((e) => e.ruleId === activeRule.id)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  const match = evaluateTicketAssignment(
    ticket as unknown as Record<string, unknown>,
    activeEntries,
  );

  if (!match) {
    return c.json(
      { error: "No matching routing entry found for this ticket" },
      400,
    );
  }

  const oldAssignedToId = ticket.assignedToId || null;
  const updatedTicket = await dbStore.tickets.update(id, {
    assignedToId: match.newAssignedToId,
  });

  const matchedEntry = activeEntries.find((e) => e.id === match.matchedEntryId);
  if (matchedEntry && matchedEntry.routingMethod === "round_robin") {
    await dbStore.ticketAssignmentRuleEntries.update(matchedEntry.id, {
      lastAssignedIndex: match.newLastAssignedIndex,
    });
  }

  await dbStore.auditLogs.insert({
    orgId: tenant.orgId,
    recordId: id,
    recordType: "Ticket",
    action: "assign",
    userId: tenant.userId,
    changes: {
      assignedToId: { before: oldAssignedToId, after: match.newAssignedToId },
    },
  });

  triggerOutboundWebhooks(tenant.orgId, "ticket.routed", {
    ticketId: id,
    assignedToId: match.newAssignedToId,
  });

  return c.json({ success: true, data: updatedTicket });
});

serviceApp.put("/tickets/:id/assign", tenantAuth, async (c) => {
  const tenant = c.get("tenant");
  const id = c.req.param("id");
  const ticket = await dbStore.tickets.findOne(id);
  if (!ticket) {
    return c.json({ error: "Ticket not found" }, 404);
  }

  const body = await c.req.json().catch(() => ({}));
  const { assignedToId } = body;

  const oldAssignedToId = ticket.assignedToId || null;
  const updated = await dbStore.tickets.update(id, {
    assignedToId: assignedToId || null,
  });

  await dbStore.auditLogs.insert({
    orgId: tenant.orgId,
    recordId: id,
    recordType: "Ticket",
    action: "assign",
    userId: tenant.userId,
    changes: {
      assignedToId: { before: oldAssignedToId, after: assignedToId || null },
    },
  });

  triggerOutboundWebhooks(tenant.orgId, "ticket.assigned", {
    ticketId: id,
    assignedToId: assignedToId || null,
  });

  return c.json({ success: true, data: updated });
});
serviceApp.post("/sla-policies", tenantAuth, async (c) => {
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

serviceApp.get("/sla-policies", tenantAuth, async (c) => {
  const policies = await dbStore.slaPolicies.findMany();
  return c.json({ success: true, data: policies });
});

serviceApp.post("/tickets/:id/milestones", tenantAuth, async (c) => {
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

serviceApp.get("/tickets/:id/milestones", tenantAuth, async (c) => {
  const ticketId = c.req.param("id");
  const ticket = await dbStore.tickets.findOne(ticketId);
  if (!ticket) {
    return c.json({ error: "Ticket not found" }, 404);
  }

  const milestones = await dbStore.ticketMilestones.findByTicket(ticketId);
  return c.json({ success: true, data: milestones });
});

serviceApp.put(
  "/tickets/:id/milestones/:milestoneId",
  tenantAuth,
  async (c) => {
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
      return c.json(
        { error: "Milestone is already completed or breached" },
        400,
      );
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
  },
);

serviceApp.post("/kb/categories", tenantAuth, async (c) => {
  const tenant = c.get("tenant");
  const body = await c.req.json().catch(() => ({}));
  const { name, description } = body;

  if (!name || typeof name !== "string" || name.trim() === "") {
    return c.json({ error: "Missing or empty required field: 'name'" }, 400);
  }

  const newCategory = await dbStore.kbCategories.insert({
    orgId: tenant.orgId,
    name: name.trim(),
    description: description || null,
  });

  await dbStore.auditLogs.insert({
    orgId: tenant.orgId,
    recordId: newCategory.id,
    recordType: "kb_categories",
    action: "create",
    userId: tenant.userId,
    changes: {
      name: { before: null, after: newCategory.name },
    },
  });

  return c.json({ success: true, data: newCategory }, 201);
});

serviceApp.get("/kb/categories", tenantAuth, async (c) => {
  const categories = await dbStore.kbCategories.findMany();
  return c.json({ success: true, data: categories });
});

serviceApp.post("/kb/articles", tenantAuth, async (c) => {
  const tenant = c.get("tenant");
  const body = await c.req.json().catch(() => ({}));
  const { title, content, status, categoryId } = body;

  if (!title || typeof title !== "string" || title.trim() === "") {
    return c.json({ error: "Missing or empty required field: 'title'" }, 400);
  }
  if (!content || typeof content !== "string" || content.trim() === "") {
    return c.json({ error: "Missing or empty required field: 'content'" }, 400);
  }
  if (!status || !validateArticleStatus(status)) {
    return c.json(
      { error: "Invalid status. Must be 'Draft' or 'Published'" },
      400,
    );
  }
  if (!categoryId) {
    return c.json({ error: "Missing required field: 'categoryId'" }, 400);
  }

  const category = await dbStore.kbCategories.findOne(categoryId);
  if (!category) {
    return c.json({ error: "Category not found" }, 404);
  }

  const newArticle = await dbStore.kbArticles.insert({
    orgId: tenant.orgId,
    categoryId,
    title: title.trim(),
    content: content.trim(),
    status: status as "Draft" | "Published",
    viewCount: 0,
    authorId: tenant.userId,
  });

  await dbStore.auditLogs.insert({
    orgId: tenant.orgId,
    recordId: newArticle.id,
    recordType: "kb_articles",
    action: "create",
    userId: tenant.userId,
    changes: {
      title: { before: null, after: newArticle.title },
      status: { before: null, after: newArticle.status },
    },
  });

  return c.json({ success: true, data: newArticle }, 201);
});

serviceApp.get("/kb/articles", tenantAuth, async (c) => {
  const categoryId = c.req.query("categoryId");
  const status = c.req.query("status");

  let articles = await dbStore.kbArticles.findMany();

  if (categoryId) {
    articles = articles.filter((a) => a.categoryId === categoryId);
  }
  if (status) {
    articles = articles.filter((a) => a.status === status);
  }

  return c.json({ success: true, data: articles });
});

serviceApp.put("/kb/articles/:id", tenantAuth, async (c) => {
  const tenant = c.get("tenant");
  const id = c.req.param("id");
  const body = await c.req.json().catch(() => ({}));
  const { title, content, status, categoryId } = body;

  const article = await dbStore.kbArticles.findOne(id);
  if (!article) {
    return c.json({ error: "Article not found" }, 404);
  }

  const updates: Record<string, unknown> = {};
  const changes: Record<string, { before: unknown; after: unknown }> = {};

  if (title !== undefined) {
    if (typeof title !== "string" || title.trim() === "") {
      return c.json({ error: "Invalid title value" }, 400);
    }
    updates.title = title.trim();
    changes.title = { before: article.title, after: updates.title };
  }

  if (content !== undefined) {
    if (typeof content !== "string" || content.trim() === "") {
      return c.json({ error: "Invalid content value" }, 400);
    }
    updates.content = content.trim();
  }

  if (status !== undefined) {
    if (!validateArticleStatus(status)) {
      return c.json(
        { error: "Invalid status value. Must be 'Draft' or 'Published'" },
        400,
      );
    }
    updates.status = status;
    changes.status = { before: article.status, after: updates.status };
  }

  if (categoryId !== undefined) {
    const category = await dbStore.kbCategories.findOne(categoryId);
    if (!category) {
      return c.json({ error: "Category not found" }, 404);
    }
    updates.categoryId = categoryId;
    changes.categoryId = { before: article.categoryId, after: categoryId };
  }

  if (Object.keys(updates).length === 0) {
    return c.json({ error: "No update fields provided" }, 400);
  }

  const updated = await dbStore.kbArticles.update(id, updates);

  await dbStore.auditLogs.insert({
    orgId: tenant.orgId,
    recordId: id,
    recordType: "kb_articles",
    action: "update",
    userId: tenant.userId,
    changes,
  });

  return c.json({ success: true, data: updated });
});

serviceApp.post("/kb/articles/:id/view", tenantAuth, async (c) => {
  const id = c.req.param("id");
  const article = await dbStore.kbArticles.findOne(id);
  if (!article) {
    return c.json({ error: "Article not found" }, 404);
  }

  const newViewCount = incrementArticleViewCount(article.viewCount);
  const updated = await dbStore.kbArticles.update(id, {
    viewCount: newViewCount,
  });

  return c.json({ success: true, data: updated });
});

serviceApp.post("/tickets/:id/comments", tenantAuth, async (c) => {
  const ticketId = c.req.param("id");
  const tenant = c.get("tenant");

  const ticket = await dbStore.tickets.findOne(ticketId);
  if (!ticket) {
    return c.json({ error: "Ticket not found" }, 404);
  }

  const body = await c.req.json();
  const validation = validateTicketCommentInput(body);
  if (!validation.success) {
    return c.json({ error: validation.error }, 400);
  }

  const comment = await dbStore.ticketComments.insert({
    orgId: tenant.orgId,
    ticketId,
    authorId: tenant.userId,
    body: body.body,
  });

  await dbStore.auditLogs.insert({
    orgId: tenant.orgId,
    recordId: comment.id,
    recordType: "ticket_comments",
    action: "create",
    userId: tenant.userId,
    changes: {
      body: { before: null, after: body.body },
    },
  });

  return c.json({ success: true, data: comment });
});

serviceApp.get("/tickets/:id/comments", tenantAuth, async (c) => {
  const ticketId = c.req.param("id");

  const ticket = await dbStore.tickets.findOne(ticketId);
  if (!ticket) {
    return c.json({ error: "Ticket not found" }, 404);
  }

  const allComments = await dbStore.ticketComments.findMany();
  const filtered = allComments
    .filter((c) => c.ticketId === ticketId)
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

  return c.json({ success: true, data: filtered });
});

serviceApp.post("/tags", tenantAuth, async (c) => {
  const tenant = c.get("tenant");
  const body = await c.req.json();
  const validation = validateTicketTagInput(body);
  if (!validation.success) {
    return c.json({ error: validation.error }, 400);
  }

  const existingTags = await dbStore.ticketTags.findMany();
  if (
    existingTags.some(
      (t) => t.name.toLowerCase() === body.name.trim().toLowerCase(),
    )
  ) {
    return c.json({ error: "Tag name already exists" }, 400);
  }

  const tag = await dbStore.ticketTags.insert({
    orgId: tenant.orgId,
    name: body.name.trim(),
    color: body.color,
  });

  await dbStore.auditLogs.insert({
    orgId: tenant.orgId,
    recordId: tag.id,
    recordType: "ticket_tags",
    action: "create",
    userId: tenant.userId,
    changes: {
      name: { before: null, after: tag.name },
      color: { before: null, after: tag.color },
    },
  });

  return c.json({ success: true, data: tag });
});

serviceApp.get("/tags", tenantAuth, async (c) => {
  const tags = await dbStore.ticketTags.findMany();
  return c.json({ success: true, data: tags });
});

serviceApp.post("/tickets/:id/tags", tenantAuth, async (c) => {
  const ticketId = c.req.param("id");
  const tenant = c.get("tenant");

  const ticket = await dbStore.tickets.findOne(ticketId);
  if (!ticket) {
    return c.json({ error: "Ticket not found" }, 404);
  }

  const body = await c.req.json();
  const { tagId } = body;
  if (!tagId) {
    return c.json({ error: "tagId is required" }, 400);
  }

  const tag = await dbStore.ticketTags.findOne(tagId);
  if (!tag) {
    return c.json({ error: "Tag not found" }, 404);
  }

  const existingLinks = await dbStore.ticketTagLinks.findMany();
  const alreadyLinked = existingLinks.find(
    (l) => l.ticketId === ticketId && l.tagId === tagId,
  );

  if (alreadyLinked) {
    return c.json({ success: true, data: alreadyLinked });
  }

  const link = await dbStore.ticketTagLinks.insert({
    orgId: tenant.orgId,
    ticketId,
    tagId,
  });

  await dbStore.auditLogs.insert({
    orgId: tenant.orgId,
    recordId: link.id,
    recordType: "ticket_tag_links",
    action: "create",
    userId: tenant.userId,
    changes: {
      ticketId: { before: null, after: ticketId },
      tagId: { before: null, after: tagId },
    },
  });

  return c.json({ success: true, data: link });
});

serviceApp.delete("/tickets/:id/tags/:tagId", tenantAuth, async (c) => {
  const ticketId = c.req.param("id");
  const tagId = c.req.param("tagId");
  const tenant = c.get("tenant");

  const ticket = await dbStore.tickets.findOne(ticketId);
  if (!ticket) {
    return c.json({ error: "Ticket not found" }, 404);
  }

  const existingLinks = await dbStore.ticketTagLinks.findMany();
  const link = existingLinks.find(
    (l) => l.ticketId === ticketId && l.tagId === tagId,
  );

  if (!link) {
    return c.json({ error: "Tag link not found" }, 404);
  }

  await dbStore.ticketTagLinks.delete(link.id);

  await dbStore.auditLogs.insert({
    orgId: tenant.orgId,
    recordId: link.id,
    recordType: "ticket_tag_links",
    action: "delete",
    userId: tenant.userId,
    changes: {
      ticketId: { before: ticketId, after: null },
      tagId: { before: tagId, after: null },
    },
  });

  return c.json({ success: true });
});

serviceApp.get("/tickets/:id/tags", tenantAuth, async (c) => {
  const ticketId = c.req.param("id");

  const ticket = await dbStore.tickets.findOne(ticketId);
  if (!ticket) {
    return c.json({ error: "Ticket not found" }, 404);
  }

  const allLinks = await dbStore.ticketTagLinks.findMany();
  const ticketLinks = allLinks.filter((l) => l.ticketId === ticketId);

  const allTags = await dbStore.ticketTags.findMany();
  const tags = ticketLinks
    .map((link) => allTags.find((t) => t.id === link.tagId))
    .filter(Boolean);

  return c.json({ success: true, data: tags });
});

serviceApp.post("/tickets/escalation-rules", tenantAuth, async (c) => {
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

serviceApp.get("/tickets/escalation-rules", tenantAuth, async (c) => {
  const rules = await dbStore.ticketEscalationRules.findMany();
  return c.json({ success: true, data: rules });
});

serviceApp.post("/tickets/:id/escalate", tenantAuth, async (c) => {
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

serviceApp.get("/tickets/:id/escalations", tenantAuth, async (c) => {
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

serviceApp.post("/tickets/macros", tenantAuth, async (c) => {
  const tenant = c.get("tenant");
  const body = await c.req.json();

  const validation = validateTicketMacroInput(body);
  if (!validation.success) {
    return c.json({ error: validation.error }, 400);
  }

  const newMacro = await dbStore.ticketMacros.insert({
    orgId: tenant.orgId,
    name: body.name,
    description: body.description || null,
    cannedResponse: body.cannedResponse,
    updateStatus: body.updateStatus || null,
    updatePriority: body.updatePriority || null,
  });

  return c.json({ success: true, data: newMacro });
});

serviceApp.get("/tickets/macros", tenantAuth, async (c) => {
  const macros = await dbStore.ticketMacros.findMany();
  return c.json({ success: true, data: macros });
});

serviceApp.post("/tickets/:id/apply-macro/:macroId", tenantAuth, async (c) => {
  const tenant = c.get("tenant");
  const ticketId = c.req.param("id");
  const macroId = c.req.param("macroId");

  const ticket = await dbStore.tickets.findOne(ticketId);
  if (!ticket) {
    return c.json({ error: "Ticket not found" }, 404);
  }

  const macro = await dbStore.ticketMacros.findOne(macroId);
  if (!macro) {
    return c.json({ error: "Macro not found" }, 404);
  }

  if (ticket.orgId !== tenant.orgId || macro.orgId !== tenant.orgId) {
    return c.json({ error: "RLS Isolation Violation: Tenant mismatch." }, 403);
  }

  const result = applyTicketMacro({
    ticket: {
      id: ticket.id,
      orgId: ticket.orgId,
      status: ticket.status,
      priority: ticket.priority || "Medium",
    },
    macro: {
      id: macro.id,
      orgId: macro.orgId,
      name: macro.name,
      cannedResponse: macro.cannedResponse,
      updateStatus: macro.updateStatus,
      updatePriority: macro.updatePriority,
    },
  });

  const updatedTicket = await dbStore.tickets.update(ticketId, {
    status: result.updatedStatus as "Open" | "In Progress" | "Resolved",
    priority: result.updatedPriority as "Low" | "Medium" | "High" | "Urgent",
  });

  const newComment = await dbStore.ticketComments.insert({
    orgId: tenant.orgId,
    ticketId: ticketId,
    authorId: tenant.userId,
    body: result.commentBody,
  });

  await dbStore.auditLogs.insert({
    orgId: tenant.orgId,
    recordId: ticketId,
    recordType: "Ticket",
    action: "apply_macro",
    userId: tenant.userId,
    changes: {
      status: { before: ticket.status, after: result.updatedStatus },
      priority: {
        before: ticket.priority || "Medium",
        after: result.updatedPriority,
      },
      commentInserted: { before: null, after: newComment.id },
    },
  });

  return c.json({
    success: true,
    data: updatedTicket,
    comment: newComment,
    message: result.auditMessage,
  });
});

serviceApp.post("/tickets/:id/feedback", tenantAuth, async (c) => {
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

serviceApp.get("/tickets/:id/feedback", tenantAuth, async (c) => {
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

serviceApp.get("/agents/:id/metrics", tenantAuth, async (c) => {
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
