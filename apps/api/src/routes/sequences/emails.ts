import { validateEmailLogInput } from "@crm/core";
import { dbStore, genId } from "@crm/db";
import { Hono } from "hono";
import { type Env, tenantAuth } from "../../middleware/tenantAuth";

export const emailsApp = new Hono<Env>();

emailsApp.post("/log", tenantAuth, async (c) => {
  const tenant = c.get("tenant");
  const body = await c.req.json().catch(() => ({}));
  const { from, to, cc, bcc, subject, body: emailBody, links } = body;

  // Validate standard RFC-compliant email inputs
  const validation = validateEmailLogInput({
    from,
    to,
    cc: cc || [],
    bcc: bcc || [],
    subject: subject || "",
    body: emailBody || "",
  });

  if (!validation.success) {
    return c.json({ error: validation.error }, 400);
  }

  // Verify that all linked entities exist and belong to the active tenant
  if (links && Array.isArray(links)) {
    for (const link of links) {
      const { targetType, targetId } = link;
      let exists = false;
      if (targetType === "Account") {
        const found = await dbStore.accounts.findOne(targetId);
        if (found) exists = true;
      } else if (targetType === "Contact") {
        const found = await dbStore.contacts.findOne(targetId);
        if (found) exists = true;
      } else if (targetType === "Lead") {
        const found = await dbStore.leads.findOne(targetId);
        if (found) exists = true;
      } else if (targetType === "Opportunity") {
        const found = await dbStore.opportunities.findOne(targetId);
        if (found) exists = true;
      }

      if (!exists) {
        return c.json(
          {
            error: `Linked target not found or tenant mismatched: ${targetType} (${targetId})`,
          },
          400,
        );
      }
    }
  }

  // Insert a new activity record of type: "email"
  const newActivity = await dbStore.activities.insert({
    orgId: tenant.orgId,
    creatorId: tenant.userId,
    type: "email",
    subject,
    body: emailBody,
    dueDate: null,
    custom: { from, to, cc: cc || [], bcc: bcc || [] },
  });

  // Insert activity links if provided
  if (links && Array.isArray(links)) {
    for (const link of links) {
      await dbStore.activityLinks.insert({
        orgId: tenant.orgId,
        activityId: newActivity.id,
        targetType: link.targetType,
        targetId: link.targetId,
      });
    }
  }

  // Log audit trail
  await dbStore.auditLogs.insert({
    orgId: tenant.orgId,
    recordId: newActivity.id,
    recordType: "EmailLog",
    action: "create",
    userId: tenant.userId,
    changes: null,
  });

  return c.json({ success: true, data: newActivity });
});

emailsApp.get("/:id", tenantAuth, async (c) => {
  const id = c.req.param("id");
  const activity = await dbStore.activities.findOne(id);

  if (activity?.type !== "email") {
    return c.json({ error: "Email log not found" }, 404);
  }

  // Get associated links
  const allLinks = await dbStore.activityLinks.findMany();
  const linked = allLinks.filter((link) => link.activityId === id);

  return c.json({
    success: true,
    data: {
      ...activity,
      links: linked,
    },
  });
});

emailsApp.post("/:activityId/tracker", tenantAuth, async (c) => {
  const tenant = c.get("tenant") as {
    orgId: string;
    userId: string;
    roleId: string;
  };
  const { activityId } = c.req.param();

  const activity = await dbStore.activities.findOne(activityId);
  if (!activity) {
    return c.json({ success: false, error: "Email activity not found" }, 404);
  }

  // Generate unique token (UUID v7)
  const token = genId("tr");

  const tracker = await dbStore.emailTrackers.insert({
    orgId: tenant.orgId,
    activityId,
    token,
  });

  return c.json({ success: true, tracker });
});

emailsApp.get("/:activityId/tracker", tenantAuth, async (c) => {
  const tenant = c.get("tenant") as {
    orgId: string;
    userId: string;
    roleId: string;
  };
  const { activityId } = c.req.param();

  const trackers = await dbStore.emailTrackers.findMany();
  const tracker = trackers.find(
    (t) => t.activityId === activityId && t.orgId === tenant.orgId,
  );

  if (!tracker) {
    return c.json({ success: false, error: "Tracker not found" }, 404);
  }

  return c.json({ success: true, tracker });
});

emailsApp.get("/trackers/:trackerId/clicks", tenantAuth, async (c) => {
  const tenant = c.get("tenant") as {
    orgId: string;
    userId: string;
    roleId: string;
  };
  const { trackerId } = c.req.param();

  const tracker = await dbStore.emailTrackers.findOne(trackerId);
  if (!tracker || tracker.orgId !== tenant.orgId) {
    return c.json(
      { success: false, error: "Tracker not found or unauthorized" },
      404,
    );
  }

  const clicks = await dbStore.emailClickEvents.findForTracker(trackerId);
  clicks.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  return c.json({ success: true, clicks });
});
