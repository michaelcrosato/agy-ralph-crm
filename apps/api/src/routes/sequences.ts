import {
  archiveMarketingSequence,
  calculateBounceAnalytics,
  calculateLinkEngagementAnalytics,
  calculateOpenAnalytics,
  calculateReadTimeAnalytics,
  calculateRecipientEngagementScore,
  calculateReplyAnalytics,
  calculateSequenceAnalytics,
  calculateUnsubscribeAnalytics,
  cloneMarketingSequence,
  compileEmailTemplate,
  deleteMarketingSequenceStep,
  detectFolderLoop,
  enrollInSequence,
  enrollSegmentInSequence,
  executePendingSequenceSteps,
  getMarketingSequenceMemberLogs,
  handleEmailDeliveryEvent,
  parseUtmParams,
  pauseMarketingSequence,
  processSequenceEmailOpen,
  processSequenceEmailReply,
  processSequenceLinkClick,
  processSequenceMembershipScoreTriggers,
  purgeMarketingSequence,
  reorderMarketingSequenceSteps,
  resolveSegmentMembers,
  resumeMarketingSequence,
  validateEmailLogInput,
  validateHexColor,
} from "@crm/core";
import {
  type DBMarketingSequence,
  dbStore,
  genId,
  mockDb,
  withTenant,
} from "@crm/db";
import { Hono } from "hono";
import { type Env, tenantAuth } from "../middleware/tenantAuth";

export const sequencesApp = new Hono<Env>();
export const emailsApp = new Hono<Env>();
export const publicEmailsApp = new Hono<Env>();

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

  // Generate unique token (UUID v7 has 128 bits of entropy — replaces previous Math.random concatenation).
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

publicEmailsApp.get("/track/open/:token", async (c) => {
  const { token } = c.req.param();
  const ipAddress =
    c.req.header("x-forwarded-for") ||
    c.req.header("cf-connecting-ip") ||
    "127.0.0.1";
  const userAgent = c.req.header("user-agent") || "Unknown";

  let deviceType = "desktop";
  if (userAgent) {
    const ua = userAgent.toLowerCase();
    if (ua.includes("ipad") || ua.includes("tablet")) {
      deviceType = "tablet";
    } else if (
      ua.includes("mobi") ||
      ua.includes("android") ||
      ua.includes("iphone")
    ) {
      deviceType = "mobile";
    }
  }

  const tracker = await dbStore.emailTrackers.findByToken(token);
  if (tracker) {
    await withTenant(tracker.orgId, mockDb, async () => {
      // Record open event publicly
      await dbStore.emailTrackers.updatePublic(tracker.id, {
        openCount: tracker.openCount + 1,
        lastOpenedAt: new Date(),
      });

      // Record granular open event
      await dbStore.emailOpenEvents.insert({
        orgId: tracker.orgId,
        trackerId: tracker.id,
        ipAddress,
        userAgent,
        deviceType,
      });

      // Record audit log for email tracking event
      await dbStore.auditLogs.insert({
        orgId: tracker.orgId,
        recordId: tracker.activityId,
        recordType: "EmailTracking",
        action: "open",
        userId: "00000000-0000-0000-0000-000000000000",
        changes: {
          openCount: {
            before: tracker.openCount,
            after: tracker.openCount + 1,
          },
        },
      });

      // Task 0198: Trigger automated sequence open actions
      if (dbStore.marketingSequenceOpenActions) {
        await processSequenceEmailOpen(
          dbStore,
          tracker.orgId,
          tracker.activityId,
        );
      }

      // Recalculate recipient engagement score
      await recalculateEngagementScoreByTrackerToken(token);
    });
  }

  // 1x1 transparent GIF
  const transparentGif = Buffer.from(
    "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
    "base64",
  );

  c.header("Content-Type", "image/gif");
  c.header("Cache-Control", "no-cache, no-store, must-revalidate");
  c.header("Pragma", "no-cache");
  c.header("Expires", "0");

  return c.body(new Uint8Array(transparentGif));
});

publicEmailsApp.get("/track/click/:token", async (c) => {
  const { token } = c.req.param();
  const target = c.req.query("target");
  const ipAddress =
    c.req.header("x-forwarded-for") ||
    c.req.header("cf-connecting-ip") ||
    "127.0.0.1";
  const userAgent = c.req.header("user-agent") || "Unknown";

  const tracker = await dbStore.emailTrackers.findByToken(token);
  if (tracker) {
    await withTenant(tracker.orgId, mockDb, async () => {
      // Record click event publicly
      await dbStore.emailTrackers.updatePublic(tracker.id, {
        clickCount: tracker.clickCount + 1,
        lastClickedAt: new Date(),
      });

      // Record granular click event
      if (target && dbStore.emailClickEvents) {
        const utm = parseUtmParams(target);
        await dbStore.emailClickEvents.insert({
          orgId: tracker.orgId,
          trackerId: tracker.id,
          clickedUrl: target,
          ipAddress,
          userAgent,
          utmSource: utm.utmSource,
          utmMedium: utm.utmMedium,
          utmCampaign: utm.utmCampaign,
          utmTerm: utm.utmTerm,
          utmContent: utm.utmContent,
        });
      }

      // Record audit log
      await dbStore.auditLogs.insert({
        orgId: tracker.orgId,
        recordId: tracker.activityId,
        recordType: "EmailTracking",
        action: "click",
        userId: "00000000-0000-0000-0000-000000000000",
        changes: {
          clickCount: {
            before: tracker.clickCount,
            after: tracker.clickCount + 1,
          },
          targetUrl: {
            before: "",
            after: target || "",
          },
        },
      });

      // Task 0197: Trigger automated sequence link actions
      if (dbStore.marketingSequenceLinkActions) {
        await processSequenceLinkClick(
          dbStore,
          tracker.orgId,
          tracker.activityId,
          target || "",
        );
      }

      // Recalculate recipient engagement score
      await recalculateEngagementScoreByTrackerToken(token);
    });
  }

  if (target) {
    return c.redirect(target, 302);
  }

  return c.redirect("/", 302);
});

publicEmailsApp.post("/track/reply/:token", async (c) => {
  const { token } = c.req.param();

  const tracker = await dbStore.emailTrackers.findByToken(token);
  if (tracker) {
    await withTenant(tracker.orgId, mockDb, async () => {
      // Record reply event publicly
      await dbStore.emailTrackers.updatePublic(tracker.id, {
        replyCount: tracker.replyCount + 1,
        lastRepliedAt: new Date(),
      });

      // Record audit log
      await dbStore.auditLogs.insert({
        orgId: tracker.orgId,
        recordId: tracker.activityId,
        recordType: "EmailTracking",
        action: "reply",
        userId: "00000000-0000-0000-0000-000000000000",
        changes: {
          replyCount: {
            before: tracker.replyCount,
            after: tracker.replyCount + 1,
          },
        },
      });

      // Record granular reply event
      const bodyData = await c.req.json().catch(() => ({}));
      const replyBody = bodyData.replyBody || null;
      let senderEmail = bodyData.senderEmail;

      // Fallback for senderEmail if not provided: find linked lead/contact email
      if (!senderEmail) {
        const allLinks = await dbStore.activityLinks.findMany();
        const recipientLink = allLinks.find(
          (l) =>
            l.activityId === tracker.activityId && l.orgId === tracker.orgId,
        );
        if (recipientLink) {
          if (recipientLink.targetType.toLowerCase() === "lead") {
            const lead = await dbStore.leads.findOne(recipientLink.targetId);
            if (lead) senderEmail = lead.email;
          } else if (recipientLink.targetType.toLowerCase() === "contact") {
            const contact = await dbStore.contacts.findOne(
              recipientLink.targetId,
            );
            if (contact) senderEmail = contact.email;
          }
        }
      }
      if (!senderEmail) {
        senderEmail = "prospect@example.com";
      }

      // Sentiment categorization
      let sentiment = "neutral";
      if (replyBody) {
        const lowerBody = replyBody.toLowerCase();
        const positiveKeywords = [
          "interested",
          "yes",
          "please",
          "great",
          "thank",
        ];
        const negativeKeywords = [
          "remove",
          "stop",
          "unsubscribe",
          "not interested",
          "no",
        ];

        if (negativeKeywords.some((kw) => lowerBody.includes(kw))) {
          sentiment = "negative";
        } else if (positiveKeywords.some((kw) => lowerBody.includes(kw))) {
          sentiment = "positive";
        }
      }

      if (dbStore.emailReplyEvents) {
        await dbStore.emailReplyEvents.insert({
          orgId: tracker.orgId,
          trackerId: tracker.id,
          replyBody,
          senderEmail,
          sentiment,
        });
      }

      // Task 0199: Trigger automated sequence reply actions
      if (dbStore.marketingSequenceReplyActions) {
        await processSequenceEmailReply(
          dbStore,
          tracker.orgId,
          tracker.activityId,
        );
      }

      // Recalculate recipient engagement score
      await recalculateEngagementScoreByTrackerToken(token);
    });
  }

  return c.json({ success: true, message: "Reply event tracked successfully" });
});

publicEmailsApp.post("/track/bounce/:token", async (c) => {
  const { token } = c.req.param();

  const tracker = await dbStore.emailTrackers.findByToken(token);
  if (tracker) {
    await withTenant(tracker.orgId, mockDb, async () => {
      // Parse parameters from body
      const bodyData = await c.req.json().catch(() => ({}));
      const eventType = bodyData.eventType || "bounce";
      const bounceType = bodyData.bounceType || null;
      const bounceReason = bodyData.bounceReason || null;

      // Find recipient email using activity links
      let recipientEmail = "prospect@example.com";
      const allLinks = await dbStore.activityLinks.findMany();
      const recipientLink = allLinks.find(
        (l) => l.activityId === tracker.activityId && l.orgId === tracker.orgId,
      );
      if (recipientLink) {
        if (recipientLink.targetType.toLowerCase() === "lead") {
          const lead = await dbStore.leads.findOne(recipientLink.targetId);
          if (lead?.email) recipientEmail = lead.email;
        } else if (recipientLink.targetType.toLowerCase() === "contact") {
          const contact = await dbStore.contacts.findOne(
            recipientLink.targetId,
          );
          if (contact?.email) recipientEmail = contact.email;
        }
      }

      await handleEmailDeliveryEvent(dbStore, {
        orgId: tracker.orgId,
        email: recipientEmail,
        event: eventType as "bounce" | "complaint",
        reason: bounceReason || undefined,
        bounceType: bounceType || undefined,
        trackerId: tracker.id,
      });

      // Recalculate recipient engagement score
      await recalculateEngagementScoreByTrackerToken(token);
    });
  }

  return c.json({
    success: true,
    message: "Bounce event tracked successfully",
  });
});

publicEmailsApp.post("/track/read-time/:token", async (c) => {
  const { token } = c.req.param();
  const tracker = await dbStore.emailTrackers.findByToken(token);
  if (tracker) {
    await withTenant(tracker.orgId, mockDb, async () => {
      const bodyData = await c.req.json().catch(() => ({}));
      const durationMs = Number(bodyData.durationMs) || 0;

      let readClassification = "glanced";
      if (durationMs >= 8000) {
        readClassification = "read";
      } else if (durationMs >= 2000) {
        readClassification = "skimmed";
      }

      await dbStore.emailTrackers.updatePublic(tracker.id, {
        totalReadTimeMs: tracker.totalReadTimeMs + durationMs,
        lastReadClassification: readClassification,
      });

      await dbStore.emailReadTimeEvents.insert({
        orgId: tracker.orgId,
        trackerId: tracker.id,
        durationMs,
        readClassification,
      });

      await dbStore.auditLogs.insert({
        orgId: tracker.orgId,
        recordId: tracker.activityId,
        recordType: "EmailTracking",
        action: "read-time",
        userId: "00000000-0000-0000-0000-000000000000",
        changes: {
          totalReadTimeMs: {
            before: tracker.totalReadTimeMs,
            after: tracker.totalReadTimeMs + durationMs,
          },
          lastReadClassification: {
            before: tracker.lastReadClassification,
            after: readClassification,
          },
        },
      });

      // Recalculate recipient engagement score
      await recalculateEngagementScoreByTrackerToken(token);
    });
  }

  return c.json({
    success: true,
    message: "Read time event tracked successfully",
  });
});

publicEmailsApp.get("/unsubscribe/:token", async (c) => {
  const { token } = c.req.param();

  const tracker = await dbStore.emailTrackers.findByToken(token);
  if (!tracker) {
    return c.json({ success: false, error: "Invalid tracking token" }, 404);
  }

  await withTenant(tracker.orgId, mockDb, async () => {
    // Find target recipients linked to this email activity
    const allLinks = await dbStore.activityLinks.findMany();
    const recipients = allLinks.filter(
      (link) =>
        link.activityId === tracker.activityId &&
        (link.targetType === "Lead" || link.targetType === "Contact"),
    );

    for (const recipient of recipients) {
      const type = recipient.targetType.toLowerCase() as "lead" | "contact";

      // Check if consent preference already exists for logging purposes
      const allPrefs = await dbStore.contactConsentPreferences.findMany();
      const existing = allPrefs.find(
        (p) =>
          p.recordType === type &&
          p.recordId === recipient.targetId &&
          p.channel === "email",
      );

      await dbStore.contactConsentPreferences.upsert({
        orgId: tracker.orgId,
        recordType: type,
        recordId: recipient.targetId,
        channel: "email",
        status: "opt_out",
        source: "public_unsubscribe",
        updatedById: "00000000-0000-0000-0000-000000000000",
      });

      // Record audit log for unsubscription consent preference update
      await dbStore.auditLogs.insert({
        orgId: tracker.orgId,
        recordId: recipient.targetId,
        recordType: "contact_consent_preferences",
        action: "upsert",
        userId: "00000000-0000-0000-0000-000000000000",
        changes: {
          status: {
            before: existing?.status || "pending",
            after: "opt_out",
          },
        },
      });

      // Transition any active marketing sequence memberships to unsubscribed
      const allMemberships =
        await dbStore.marketingSequenceMemberships.findMany();
      const matchingMemberships = allMemberships.filter(
        (m) =>
          m.recordId === recipient.targetId &&
          m.recordType.toLowerCase() === type.toLowerCase(),
      );
      for (const m of matchingMemberships) {
        await dbStore.marketingSequenceMemberships.update(m.id, {
          status: "unsubscribed",
        });
        await recalculateMemberEngagementScore(m.id);
      }
    }
  });

  const html = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <title>Unsubscribed Successfully</title>
    <style>
      body {
        font-family: 'Inter', -apple-system, sans-serif;
        background: #f3f4f6;
        display: flex;
        align-items: center;
        justify-content: center;
        height: 100vh;
        margin: 0;
      }
      .card {
        background: white;
        padding: 40px;
        border-radius: 12px;
        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
        text-align: center;
        max-width: 400px;
      }
      h1 { color: #1f2937; font-size: 24px; margin-bottom: 8px; }
      p { color: #4b5563; font-size: 16px; margin-bottom: 24px; line-height: 1.5; }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>Successfully Unsubscribed</h1>
      <p>Your email address has been opted out from our marketing and campaign communications.</p>
    </div>
  </body>
</html>`;

  c.header("Content-Type", "text/html");
  return c.body(html);
});

publicEmailsApp.post("/unsubscribe/:token/reason", async (c) => {
  const { token } = c.req.param();
  const body = await c.req.json().catch(() => ({}));
  const { reason, feedback } = body;

  if (!reason) {
    return c.json({ success: false, error: "Reason is required" }, 400);
  }

  const allowedReasons = ["frequency", "relevance", "not_requested", "other"];
  if (!allowedReasons.includes(reason)) {
    return c.json({ success: false, error: "Invalid unsubscribe reason" }, 400);
  }

  const tracker = await dbStore.emailTrackers.findByToken(token);
  if (!tracker) {
    return c.json({ success: false, error: "Invalid tracking token" }, 404);
  }

  const newUnsub = await withTenant(tracker.orgId, mockDb, async () => {
    const inserted = await dbStore.emailUnsubscribes.insert({
      orgId: tracker.orgId,
      trackerId: tracker.id,
      reason,
      feedback: feedback || null,
    });

    // Record audit log
    await dbStore.auditLogs.insert({
      orgId: tracker.orgId,
      recordId: tracker.activityId,
      recordType: "EmailTracking",
      action: "unsubscribe_reason",
      userId: "00000000-0000-0000-0000-000000000000",
      changes: {
        reason: {
          before: null,
          after: reason,
        },
        feedback: {
          before: null,
          after: feedback || null,
        },
      },
    });

    return inserted;
  });

  return c.json({ success: true, data: newUnsub });
});

sequencesApp.post("/", tenantAuth, async (c) => {
  const tenant = c.get("tenant");
  const body = await c.req.json().catch(() => ({}));
  const {
    name,
    description,
    status,
    allowReenrollment,
    reenrollmentMinDays,
    dailySendLimit,
    senderType,
    senderUserId,
    folderId,
  } = body;

  if (!name) {
    return c.json({ success: false, error: "Sequence name is required" }, 400);
  }

  if (folderId) {
    const folder = await dbStore.marketingSequenceFolders.findOne(folderId);
    if (!folder) {
      return c.json({ success: false, error: "Folder not found" }, 400);
    }
  }

  let parsedLimit: number | null = null;
  if (dailySendLimit !== undefined && dailySendLimit !== null) {
    const num = Number(dailySendLimit);
    if (!Number.isInteger(num) || num <= 0) {
      return c.json(
        { success: false, error: "dailySendLimit must be a positive integer" },
        400,
      );
    }
    parsedLimit = num;
  }

  let resolvedSenderType = "system";
  if (senderType !== undefined && senderType !== null) {
    if (
      senderType !== "system" &&
      senderType !== "owner" &&
      senderType !== "specific"
    ) {
      return c.json(
        {
          success: false,
          error: "senderType must be one of 'system', 'owner', or 'specific'",
        },
        400,
      );
    }
    resolvedSenderType = senderType;
  }

  let resolvedSenderUserId: string | null = null;
  if (resolvedSenderType === "specific") {
    if (!senderUserId) {
      return c.json(
        {
          success: false,
          error: "senderUserId is required when senderType is 'specific'",
        },
        400,
      );
    }
    const activeMembers = await dbStore.memberships.findMany();
    const isValidMember = activeMembers.some((m) => m.userId === senderUserId);
    if (!isValidMember) {
      return c.json(
        {
          success: false,
          error:
            "Invalid senderUserId: user does not belong to your organization",
        },
        400,
      );
    }
    resolvedSenderUserId = senderUserId;
  }

  const seq = await dbStore.marketingSequences.insert({
    orgId: tenant.orgId,
    name,
    description: description || "",
    status: status || "draft",
    allowReenrollment: allowReenrollment === true,
    reenrollmentMinDays: reenrollmentMinDays
      ? Number(reenrollmentMinDays)
      : null,
    dailySendLimit: parsedLimit,
    senderType: resolvedSenderType,
    senderUserId: resolvedSenderUserId,
    folderId: folderId || null,
  });

  return c.json({ success: true, sequence: seq });
});

sequencesApp.patch("/:id", tenantAuth, async (c) => {
  const sequenceId = c.req.param("id");
  const _tenant = c.get("tenant");
  const body = await c.req.json().catch(() => ({}));
  const {
    name,
    description,
    status,
    allowReenrollment,
    reenrollmentMinDays,
    dailySendLimit,
    senderType,
    senderUserId,
    folderId,
  } = body;

  const seq = await dbStore.marketingSequences.findOne(sequenceId);
  if (!seq) {
    return c.json({ success: false, error: "Sequence not found" }, 404);
  }

  const updates: Record<string, unknown> = {};
  if (name !== undefined) updates.name = name;
  if (description !== undefined) updates.description = description;
  if (status !== undefined) updates.status = status;
  if (folderId !== undefined) {
    if (folderId !== null) {
      const folder = await dbStore.marketingSequenceFolders.findOne(folderId);
      if (!folder) {
        return c.json({ success: false, error: "Folder not found" }, 400);
      }
      updates.folderId = folderId;
    } else {
      updates.folderId = null;
    }
  }

  if (allowReenrollment !== undefined)
    updates.allowReenrollment = allowReenrollment === true;
  if (reenrollmentMinDays !== undefined) {
    updates.reenrollmentMinDays = reenrollmentMinDays
      ? Number(reenrollmentMinDays)
      : null;
  }
  if (dailySendLimit !== undefined) {
    if (dailySendLimit !== null) {
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
      updates.dailySendLimit = num;
    } else {
      updates.dailySendLimit = null;
    }
  }

  let resolvedSenderType =
    (updates.senderType as string) || seq.senderType || "system";
  if (senderType !== undefined) {
    if (
      senderType !== "system" &&
      senderType !== "owner" &&
      senderType !== "specific"
    ) {
      return c.json(
        {
          success: false,
          error: "senderType must be one of 'system', 'owner', or 'specific'",
        },
        400,
      );
    }
    updates.senderType = senderType;
    resolvedSenderType = senderType;
  }

  if (senderUserId !== undefined) {
    updates.senderUserId = senderUserId;
  }

  const finalSenderUserId =
    updates.senderUserId !== undefined
      ? (updates.senderUserId as string | null)
      : seq.senderUserId;
  if (resolvedSenderType === "specific") {
    if (!finalSenderUserId) {
      return c.json(
        {
          success: false,
          error: "senderUserId is required when senderType is 'specific'",
        },
        400,
      );
    }
    const activeMembers = await dbStore.memberships.findMany();
    const isValidMember = activeMembers.some(
      (m) => m.userId === finalSenderUserId,
    );
    if (!isValidMember) {
      return c.json(
        {
          success: false,
          error:
            "Invalid senderUserId: user does not belong to your organization",
        },
        400,
      );
    }
  } else {
    if (senderType !== undefined) {
      updates.senderUserId = null;
    }
  }

  const updated = await dbStore.marketingSequences.update(
    sequenceId,
    updates as Partial<
      Omit<DBMarketingSequence, "id" | "orgId" | "createdAt" | "updatedAt">
    >,
  );
  return c.json({ success: true, sequence: updated });
});

sequencesApp.post("/:id/steps", tenantAuth, async (c) => {
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

sequencesApp.post("/:id/enroll", tenantAuth, async (c) => {
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

sequencesApp.post("/execute", tenantAuth, async (c) => {
  const processed = await executePendingSequenceSteps(dbStore, new Date());
  return c.json({ success: true, processedCount: processed });
});

sequencesApp.post("/preview", tenantAuth, async (c) => {
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

sequencesApp.get("/:id/members", tenantAuth, async (c) => {
  const sequenceId = c.req.param("id");
  const seq = await dbStore.marketingSequences.findOne(sequenceId);
  if (!seq) {
    return c.json({ success: false, error: "Sequence not found" }, 404);
  }

  const members =
    await dbStore.marketingSequenceMemberships.findForSequence(sequenceId);
  return c.json({ success: true, data: members });
});

sequencesApp.get("/:id/analytics", tenantAuth, async (c) => {
  const sequenceId = c.req.param("id");
  const seq = await dbStore.marketingSequences.findOne(sequenceId);
  if (!seq) {
    return c.json({ success: false, error: "Sequence not found" }, 404);
  }

  const steps =
    await dbStore.marketingSequenceSteps.findForSequence(sequenceId);
  const memberships =
    await dbStore.marketingSequenceMemberships.findForSequence(sequenceId);
  const activities = await dbStore.activities.findMany();
  const activityLinks = await dbStore.activityLinks.findMany();
  const emailTrackers = await dbStore.emailTrackers.findMany();

  const analytics = calculateSequenceAnalytics({
    sequenceId,
    steps,
    memberships,
    activities,
    activityLinks,
    emailTrackers,
  });

  return c.json({ success: true, data: analytics });
});

sequencesApp.get("/:id/exit-triggers", tenantAuth, async (c) => {
  const sequenceId = c.req.param("id");
  const seq = await dbStore.marketingSequences.findOne(sequenceId);
  if (!seq) {
    return c.json({ success: false, error: "Sequence not found" }, 404);
  }
  const triggers =
    await dbStore.marketingSequenceExitTriggers.findForSequence(sequenceId);
  return c.json({ success: true, data: triggers });
});

sequencesApp.post("/:id/exit-triggers", tenantAuth, async (c) => {
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

sequencesApp.delete("/:id/exit-triggers/:triggerId", tenantAuth, async (c) => {
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

sequencesApp.get("/:id/steps/:stepId/split-test", tenantAuth, async (c) => {
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

sequencesApp.post("/:id/steps/:stepId/split-test", tenantAuth, async (c) => {
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

sequencesApp.post(
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

sequencesApp.get("/:id/steps/:stepId/branch", tenantAuth, async (c) => {
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

sequencesApp.post("/:id/steps/:stepId/branch", tenantAuth, async (c) => {
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

sequencesApp.delete("/:id/steps/:stepId/branch", tenantAuth, async (c) => {
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

sequencesApp.get("/:id/goals", tenantAuth, async (c) => {
  const sequenceId = c.req.param("id");
  const seq = await dbStore.marketingSequences.findOne(sequenceId);
  if (!seq) {
    return c.json({ success: false, error: "Sequence not found" }, 404);
  }

  const goals =
    await dbStore.marketingSequenceGoals.findForSequence(sequenceId);
  return c.json({ success: true, data: goals });
});

sequencesApp.post("/:id/goals", tenantAuth, async (c) => {
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

sequencesApp.get("/suppressions", tenantAuth, async (c) => {
  const suppressions = await dbStore.marketingSequenceSuppressions.findMany();
  return c.json({ success: true, data: suppressions });
});

sequencesApp.post("/suppressions", tenantAuth, async (c) => {
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

sequencesApp.delete("/suppressions/:id", tenantAuth, async (c) => {
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

sequencesApp.get("/:id/exclusions", tenantAuth, async (c) => {
  const sequenceId = c.req.param("id");
  const seq = await dbStore.marketingSequences.findOne(sequenceId);
  if (!seq) {
    return c.json({ success: false, error: "Sequence not found" }, 404);
  }

  const exclusions =
    await dbStore.marketingSequenceExclusions.findForSequence(sequenceId);
  return c.json({ success: true, data: exclusions });
});

sequencesApp.post("/:id/exclusions", tenantAuth, async (c) => {
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

sequencesApp.delete("/:id/exclusions/:exclusionId", tenantAuth, async (c) => {
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

sequencesApp.get("/:id/conversion-analytics", tenantAuth, async (c) => {
  const sequenceId = c.req.param("id");
  const seq = await dbStore.marketingSequences.findOne(sequenceId);
  if (!seq) {
    return c.json({ success: false, error: "Sequence not found" }, 404);
  }

  const memberships =
    await dbStore.marketingSequenceMemberships.findForSequence(sequenceId);
  const conversions =
    await dbStore.marketingSequenceConversions.findForSequence(sequenceId);

  const totalEnrolled = memberships.length;
  const convertedCount = conversions.length;
  const conversionRate =
    totalEnrolled > 0
      ? `${((convertedCount / totalEnrolled) * 100).toFixed(2)}%`
      : "0.00%";

  const totalAttributedRevenue = conversions
    .reduce((sum, conv) => {
      const amt = Number.parseFloat(conv.attributedRevenue || "0.00");
      return sum + (Number.isNaN(amt) ? 0 : amt);
    }, 0)
    .toFixed(2);

  // Calculate average days to convert
  let totalDays = 0;
  let convertTimeCount = 0;

  for (const conv of conversions) {
    const memb = memberships.find((m) => m.id === conv.membershipId);
    if (memb?.createdAt) {
      const diffMs =
        new Date(conv.convertedAt).getTime() -
        new Date(memb.createdAt).getTime();
      totalDays += diffMs / (1000 * 60 * 60 * 24);
      convertTimeCount++;
    }
  }

  const averageDaysToConvert =
    convertTimeCount > 0
      ? Number.parseFloat((totalDays / convertTimeCount).toFixed(2))
      : 0;

  return c.json({
    success: true,
    data: {
      sequenceId,
      totalEnrolled,
      convertedCount,
      conversionRate,
      totalAttributedRevenue,
      averageDaysToConvert,
    },
  });
});

sequencesApp.post("/:id/enroll-segment", tenantAuth, async (c) => {
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

sequencesApp.post("/:id/schedule", tenantAuth, async (c) => {
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

sequencesApp.post(
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

sequencesApp.post(
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

sequencesApp.post("/email-event", tenantAuth, async (c) => {
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

sequencesApp.get("/settings/variables", tenantAuth, async (c) => {
  const _tenant = c.get("tenant");
  const variables = await dbStore.marketingSequenceGlobalVariables.findMany();
  return c.json({ success: true, data: variables });
});

sequencesApp.post("/settings/variables", tenantAuth, async (c) => {
  const tenant = c.get("tenant");
  const body = await c.req.json().catch(() => ({}));
  const { key, value } = body;

  if (!key || typeof key !== "string" || !/^[A-Za-z0-9_]+$/.test(key)) {
    return c.json(
      {
        success: false,
        error:
          "key is required and must contain only alphanumeric characters and underscores",
      },
      400,
    );
  }

  if (value === undefined || typeof value !== "string") {
    return c.json(
      {
        success: false,
        error: "value is required and must be a string",
      },
      400,
    );
  }

  const variable = await dbStore.marketingSequenceGlobalVariables.insert({
    orgId: tenant.orgId,
    key,
    value,
  });

  return c.json({ success: true, data: variable }, 201);
});

sequencesApp.delete("/settings/variables/:id", tenantAuth, async (c) => {
  const id = c.req.param("id");
  const variable = await dbStore.marketingSequenceGlobalVariables.findOne(id);
  if (!variable) {
    return c.json({ success: false, error: "Global variable not found" }, 404);
  }

  const deleted = await dbStore.marketingSequenceGlobalVariables.delete(id);
  if (!deleted) {
    return c.json({ success: false, error: "Global variable not found" }, 404);
  }

  return c.json({
    success: true,
    message: "Global variable deleted successfully",
  });
});

sequencesApp.get("/settings/caps", tenantAuth, async (c) => {
  const _tenant = c.get("tenant");
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

sequencesApp.post("/settings/caps", tenantAuth, async (c) => {
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

  const caps = await dbStore.marketingSequenceCaps.findMany();
  if (caps.length === 0) {
    const inserted = await dbStore.marketingSequenceCaps.insert({
      orgId: tenant.orgId,
      domainThrottleLimit:
        domainThrottleLimit !== undefined ? Number(domainThrottleLimit) : 5,
      recipientFrequencyCap:
        recipientFrequencyCap !== undefined ? Number(recipientFrequencyCap) : 3,
    });
    return c.json({ success: true, data: inserted });
  }
  const updated = await dbStore.marketingSequenceCaps.update(caps[0].id, {
    domainThrottleLimit:
      domainThrottleLimit !== undefined
        ? Number(domainThrottleLimit)
        : caps[0].domainThrottleLimit,
    recipientFrequencyCap:
      recipientFrequencyCap !== undefined
        ? Number(recipientFrequencyCap)
        : caps[0].recipientFrequencyCap,
  });
  return c.json({ success: true, data: updated });
});

sequencesApp.get("/steps/:stepId/link-actions", tenantAuth, async (c) => {
  const stepId = c.req.param("stepId");
  const actions =
    await dbStore.marketingSequenceLinkActions.findForStep(stepId);
  return c.json({ success: true, data: actions });
});

sequencesApp.post("/steps/:stepId/link-actions", tenantAuth, async (c) => {
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

sequencesApp.delete("/steps/link-actions/:id", tenantAuth, async (c) => {
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

sequencesApp.get("/steps/:stepId/open-actions", tenantAuth, async (c) => {
  const stepId = c.req.param("stepId");
  const actions =
    await dbStore.marketingSequenceOpenActions.findForStep(stepId);
  return c.json({ success: true, data: actions });
});

sequencesApp.post("/steps/:stepId/open-actions", tenantAuth, async (c) => {
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

sequencesApp.delete("/steps/open-actions/:id", tenantAuth, async (c) => {
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

sequencesApp.get("/steps/:stepId/reply-actions", tenantAuth, async (c) => {
  const stepId = c.req.param("stepId");
  const actions =
    await dbStore.marketingSequenceReplyActions.findForStep(stepId);
  return c.json({ success: true, data: actions });
});

sequencesApp.post("/steps/:stepId/reply-actions", tenantAuth, async (c) => {
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

sequencesApp.delete("/steps/reply-actions/:id", tenantAuth, async (c) => {
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

sequencesApp.get("/:id/links-analytics", tenantAuth, async (c) => {
  const sequenceId = c.req.param("id");
  const seq = await dbStore.marketingSequences.findOne(sequenceId);
  if (!seq) {
    return c.json({ success: false, error: "Sequence not found" }, 404);
  }

  const clicks = await dbStore.emailClickEvents.findMany();
  const trackers = await dbStore.emailTrackers.findMany();
  const activities = await dbStore.activities.findMany();
  const activityLinks = await dbStore.activityLinks.findMany();
  const memberships =
    await dbStore.marketingSequenceMemberships.findForSequence(sequenceId);
  const steps =
    await dbStore.marketingSequenceSteps.findForSequence(sequenceId);

  const analytics = calculateLinkEngagementAnalytics({
    clicks,
    trackers,
    activities,
    activityLinks,
    memberships,
    steps,
    sequenceId,
  });

  return c.json({ success: true, data: analytics });
});

sequencesApp.get("/:id/opens-analytics", tenantAuth, async (c) => {
  const sequenceId = c.req.param("id");
  const seq = await dbStore.marketingSequences.findOne(sequenceId);
  if (!seq) {
    return c.json({ success: false, error: "Sequence not found" }, 404);
  }

  const opens = await dbStore.emailOpenEvents.findMany();
  const trackers = await dbStore.emailTrackers.findMany();
  const activities = await dbStore.activities.findMany();
  const activityLinks = await dbStore.activityLinks.findMany();
  const memberships =
    await dbStore.marketingSequenceMemberships.findForSequence(sequenceId);
  const steps =
    await dbStore.marketingSequenceSteps.findForSequence(sequenceId);

  const analytics = calculateOpenAnalytics({
    opens,
    trackers,
    activities,
    activityLinks,
    memberships,
    steps,
    sequenceId,
  });

  return c.json({ success: true, data: analytics });
});

sequencesApp.get("/:id/replies-analytics", tenantAuth, async (c) => {
  const sequenceId = c.req.param("id");
  const seq = await dbStore.marketingSequences.findOne(sequenceId);
  if (!seq) {
    return c.json({ success: false, error: "Sequence not found" }, 404);
  }

  const replies = await dbStore.emailReplyEvents.findMany();
  const trackers = await dbStore.emailTrackers.findMany();
  const activities = await dbStore.activities.findMany();
  const activityLinks = await dbStore.activityLinks.findMany();
  const memberships =
    await dbStore.marketingSequenceMemberships.findForSequence(sequenceId);
  const steps =
    await dbStore.marketingSequenceSteps.findForSequence(sequenceId);

  const analytics = calculateReplyAnalytics({
    replies,
    trackers,
    activities,
    activityLinks,
    memberships,
    steps,
    sequenceId,
  });

  return c.json({ success: true, data: analytics });
});

sequencesApp.get("/:id/bounces-analytics", tenantAuth, async (c) => {
  const sequenceId = c.req.param("id");
  const seq = await dbStore.marketingSequences.findOne(sequenceId);
  if (!seq) {
    return c.json({ success: false, error: "Sequence not found" }, 404);
  }

  const bounces = await dbStore.emailBounceEvents.findMany();
  const trackers = await dbStore.emailTrackers.findMany();
  const activities = await dbStore.activities.findMany();
  const activityLinks = await dbStore.activityLinks.findMany();
  const memberships =
    await dbStore.marketingSequenceMemberships.findForSequence(sequenceId);
  const steps =
    await dbStore.marketingSequenceSteps.findForSequence(sequenceId);

  const analytics = calculateBounceAnalytics({
    bounces,
    trackers,
    activities,
    activityLinks,
    memberships,
    steps,
    sequenceId,
  });

  return c.json({ success: true, data: analytics });
});

sequencesApp.get("/:id/read-time-analytics", tenantAuth, async (c) => {
  const sequenceId = c.req.param("id");
  const seq = await dbStore.marketingSequences.findOne(sequenceId);
  if (!seq) {
    return c.json({ success: false, error: "Sequence not found" }, 404);
  }

  const readTimeEvents = await dbStore.emailReadTimeEvents.findMany();
  const trackers = await dbStore.emailTrackers.findMany();
  const activities = await dbStore.activities.findMany();
  const activityLinks = await dbStore.activityLinks.findMany();
  const memberships =
    await dbStore.marketingSequenceMemberships.findForSequence(sequenceId);
  const steps =
    await dbStore.marketingSequenceSteps.findForSequence(sequenceId);

  const analytics = calculateReadTimeAnalytics({
    readTimeEvents,
    trackers,
    activities,
    activityLinks,
    memberships,
    steps,
    sequenceId,
  });

  return c.json({ success: true, data: analytics });
});

async function recalculateMemberEngagementScore(
  membershipId: string,
): Promise<number> {
  const membership =
    await dbStore.marketingSequenceMemberships.findOne(membershipId);
  if (!membership) return 0;

  const allLinks = await dbStore.activityLinks.findMany();
  const memberLinks = allLinks.filter(
    (l) =>
      l.targetId === membership.recordId &&
      l.targetType.toLowerCase() === membership.recordType.toLowerCase(),
  );

  const activityIds = memberLinks.map((l) => l.activityId);

  const allTrackers = await dbStore.emailTrackers.findMany();
  const memberTrackers = allTrackers.filter(
    (t) => t.activityId && activityIds.includes(t.activityId),
  );

  const trackerIds = memberTrackers.map((t) => t.id);

  const allReadTimeEvents = await dbStore.emailReadTimeEvents.findMany();
  const memberReadTimeEvents = allReadTimeEvents.filter((e) =>
    trackerIds.includes(e.trackerId),
  );

  const allBounceEvents = await dbStore.emailBounceEvents.findMany();
  const memberBounceEvents = allBounceEvents.filter((e) =>
    trackerIds.includes(e.trackerId),
  );

  let openCount = 0;
  let clickCount = 0;
  let replyCount = 0;
  for (const t of memberTrackers) {
    openCount += t.openCount;
    clickCount += t.clickCount;
    replyCount += t.replyCount;
  }

  const isUnsubscribed = membership.status === "unsubscribed";

  const score = calculateRecipientEngagementScore({
    openCount,
    clickCount,
    replyCount,
    readTimeEvents: memberReadTimeEvents.map((e) => ({
      durationMs: e.durationMs,
      readClassification: e.readClassification,
    })),
    bounceEvents: memberBounceEvents.map((e) => ({
      eventType: e.eventType,
      bounceType: e.bounceType,
    })),
    isUnsubscribed,
  });

  await dbStore.marketingSequenceMemberships.update(membershipId, {
    engagementScore: score,
  });

  await processSequenceMembershipScoreTriggers(
    dbStore,
    membership.orgId,
    membershipId,
  );

  return score;
}

async function recalculateEngagementScoreByTrackerToken(
  token: string,
): Promise<void> {
  const tracker = await dbStore.emailTrackers.findByToken(token);
  if (!tracker) return;

  const allLinks = await dbStore.activityLinks.findMany();
  const link = allLinks.find((l) => l.activityId === tracker.activityId);
  if (!link) return;

  const allMemberships = await dbStore.marketingSequenceMemberships.findMany();
  const membership = allMemberships.find(
    (m) =>
      m.recordId === link.targetId &&
      m.recordType.toLowerCase() === link.targetType.toLowerCase(),
  );

  if (membership) {
    await withTenant(membership.orgId, mockDb, async () => {
      await recalculateMemberEngagementScore(membership.id);
    });
  }
}

sequencesApp.get("/:id/engagement-scores", tenantAuth, async (c) => {
  const sequenceId = c.req.param("id");
  const seq = await dbStore.marketingSequences.findOne(sequenceId);
  if (!seq) {
    return c.json({ success: false, error: "Sequence not found" }, 404);
  }

  const memberships =
    await dbStore.marketingSequenceMemberships.findForSequence(sequenceId);

  const data = [];
  for (const m of memberships) {
    let name = "Unknown";
    let email = "prospect@example.com";

    if (m.recordType === "lead") {
      const lead = await dbStore.leads.findOne(m.recordId);
      if (lead) {
        name = lead.company || lead.email || "Unknown";
        email = lead.email || "prospect@example.com";
      }
    } else if (m.recordType === "contact") {
      const contact = await dbStore.contacts.findOne(m.recordId);
      if (contact) {
        name = `${contact.firstName} ${contact.lastName}`.trim() || "Unknown";
        email = contact.email || "prospect@example.com";
      }
    }

    data.push({
      membershipId: m.id,
      recordType: m.recordType,
      recordId: m.recordId,
      recordName: name,
      email,
      status: m.status,
      engagementScore: m.engagementScore ?? 0,
    });
  }

  return c.json({ success: true, data });
});

sequencesApp.post("/members/:id/recalculate-score", tenantAuth, async (c) => {
  const membershipId = c.req.param("id");
  const membership =
    await dbStore.marketingSequenceMemberships.findOne(membershipId);
  if (!membership) {
    return c.json({ success: false, error: "Membership not found" }, 404);
  }

  const score = await recalculateMemberEngagementScore(membershipId);
  return c.json({
    success: true,
    message: "Engagement score recalculated successfully",
    engagementScore: score,
  });
});

sequencesApp.post("/:id/triggers", tenantAuth, async (c) => {
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

sequencesApp.get("/:id/triggers", tenantAuth, async (c) => {
  const sequenceId = c.req.param("id");
  const seq = await dbStore.marketingSequences.findOne(sequenceId);
  if (!seq) {
    return c.json({ success: false, error: "Sequence not found" }, 404);
  }

  const triggers =
    await dbStore.marketingSequenceScoreTriggers.findForSequence(sequenceId);
  return c.json({ success: true, data: triggers });
});

sequencesApp.delete("/triggers/:id", tenantAuth, async (c) => {
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

sequencesApp.post("/folders", tenantAuth, async (c) => {
  const tenant = c.get("tenant");
  const body = await c.req.json().catch(() => ({}));
  const { name, parentFolderId } = body;

  if (!name) {
    return c.json({ success: false, error: "Folder name is required" }, 400);
  }

  // 1. Verify parent folder if provided
  if (parentFolderId) {
    const parentFolder =
      await dbStore.marketingSequenceFolders.findOne(parentFolderId);
    if (!parentFolder) {
      return c.json({ success: false, error: "Parent folder not found" }, 400);
    }
  }

  // 2. Check for unique name under same parent
  const allFolders = await dbStore.marketingSequenceFolders.findMany();
  const duplicateName = allFolders.some(
    (f) =>
      f.name.toLowerCase() === name.toLowerCase() &&
      f.parentFolderId === (parentFolderId || null),
  );
  if (duplicateName) {
    return c.json(
      {
        success: false,
        error: "A folder with this name already exists in this location",
      },
      400,
    );
  }

  const folder = await dbStore.marketingSequenceFolders.insert({
    orgId: tenant.orgId,
    name,
    parentFolderId: parentFolderId || null,
  });

  return c.json({ success: true, folder });
});

sequencesApp.patch("/folders/:id", tenantAuth, async (c) => {
  const id = c.req.param("id");
  const _tenant = c.get("tenant");
  const body = await c.req.json().catch(() => ({}));
  const { name, parentFolderId } = body;

  const folder = await dbStore.marketingSequenceFolders.findOne(id);
  if (!folder) {
    return c.json({ success: false, error: "Folder not found" }, 404);
  }

  const updates: Record<string, unknown> = {};

  if (parentFolderId !== undefined) {
    if (parentFolderId !== null) {
      // a. Verify parent exists
      const parentFolder =
        await dbStore.marketingSequenceFolders.findOne(parentFolderId);
      if (!parentFolder) {
        return c.json(
          { success: false, error: "Parent folder not found" },
          400,
        );
      }
      // b. Detect loops using core function
      const allFolders = await dbStore.marketingSequenceFolders.findMany();
      const hasLoop = detectFolderLoop(
        id,
        parentFolderId,
        allFolders.map((f) => ({
          id: f.id,
          parentFolderId: f.parentFolderId,
        })),
      );
      if (hasLoop) {
        return c.json(
          { success: false, error: "Recursive folder loop detected" },
          400,
        );
      }
      updates.parentFolderId = parentFolderId;
    } else {
      updates.parentFolderId = null;
    }
  }

  if (name) {
    // Check uniqueness
    const parentIdToCheck =
      parentFolderId !== undefined ? parentFolderId : folder.parentFolderId;
    const allFolders = await dbStore.marketingSequenceFolders.findMany();
    const duplicateName = allFolders.some(
      (f) =>
        f.id !== id &&
        f.name.toLowerCase() === name.toLowerCase() &&
        f.parentFolderId === (parentIdToCheck || null),
    );
    if (duplicateName) {
      return c.json(
        {
          success: false,
          error: "A folder with this name already exists in this location",
        },
        400,
      );
    }
    updates.name = name;
  }

  const updated = await dbStore.marketingSequenceFolders.update(id, updates);
  return c.json({ success: true, folder: updated });
});

sequencesApp.get("/folders", tenantAuth, async (c) => {
  const folders = await dbStore.marketingSequenceFolders.findMany();
  return c.json({ success: true, data: folders });
});

sequencesApp.post("/tags", tenantAuth, async (c) => {
  const tenant = c.get("tenant");
  const body = await c.req.json().catch(() => ({}));
  const { name, color } = body;

  if (!name || !color) {
    return c.json(
      { success: false, error: "Name and color are required" },
      400,
    );
  }

  if (!validateHexColor(color)) {
    return c.json(
      { success: false, error: "Invalid hex color code format" },
      400,
    );
  }

  const allTags = await dbStore.marketingSequenceTags.findMany();
  const duplicate = allTags.some(
    (t) => t.name.toLowerCase() === name.toLowerCase(),
  );
  if (duplicate) {
    return c.json({ success: false, error: "Tag already exists" }, 400);
  }

  const tag = await dbStore.marketingSequenceTags.insert({
    orgId: tenant.orgId,
    name,
    color,
  });

  return c.json({ success: true, tag });
});

sequencesApp.get("/tags", tenantAuth, async (c) => {
  const tags = await dbStore.marketingSequenceTags.findMany();
  return c.json({ success: true, data: tags });
});

sequencesApp.post("/:id/tags", tenantAuth, async (c) => {
  const sequenceId = c.req.param("id");
  const tenant = c.get("tenant");
  const body = await c.req.json().catch(() => ({}));
  const { tagId } = body;

  if (!tagId) {
    return c.json({ success: false, error: "tagId is required" }, 400);
  }

  const sequence = await dbStore.marketingSequences.findOne(sequenceId);
  if (!sequence) {
    return c.json({ success: false, error: "Sequence not found" }, 404);
  }

  const tag = await dbStore.marketingSequenceTags.findOne(tagId);
  if (!tag) {
    return c.json({ success: false, error: "Tag not found" }, 404);
  }

  const existingMappings =
    await dbStore.marketingSequenceTagMappings.findForSequence(sequenceId);
  const alreadyMapped = existingMappings.some((m) => m.tagId === tagId);
  if (alreadyMapped) {
    return c.json({
      success: true,
      message: "Tag already mapped to sequence",
    });
  }

  const mapping = await dbStore.marketingSequenceTagMappings.insert({
    orgId: tenant.orgId,
    sequenceId,
    tagId,
  });

  return c.json({ success: true, mapping });
});

sequencesApp.delete("/:id/tags/:tagId", tenantAuth, async (c) => {
  const sequenceId = c.req.param("id");
  const tagId = c.req.param("tagId");

  const deleted =
    await dbStore.marketingSequenceTagMappings.deleteForSequenceAndTag(
      sequenceId,
      tagId,
    );
  if (!deleted) {
    return c.json({ success: false, error: "Mapping not found" }, 404);
  }

  return c.json({
    success: true,
    message: "Tag detached from sequence successfully",
  });
});

sequencesApp.get("/", tenantAuth, async (c) => {
  const folderId = c.req.query("folderId");
  const tagId = c.req.query("tagId");

  let sequences = await dbStore.marketingSequences.findMany();

  if (folderId) {
    sequences = sequences.filter((s) => s.folderId === folderId);
  }

  if (tagId) {
    const mappings = await dbStore.marketingSequenceTagMappings.findMany();
    const sequenceIdsWithTag = mappings
      .filter((m) => m.tagId === tagId)
      .map((m) => m.sequenceId);
    sequences = sequences.filter((s) => sequenceIdsWithTag.includes(s.id));
  }

  return c.json({ success: true, data: sequences });
});

sequencesApp.get("/:id", tenantAuth, async (c) => {
  const id = c.req.param("id");
  const sequence = await dbStore.marketingSequences.findOne(id);
  if (!sequence) {
    return c.json({ success: false, error: "Sequence not found" }, 404);
  }

  const mappings =
    await dbStore.marketingSequenceTagMappings.findForSequence(id);
  const tags = [];
  for (const m of mappings) {
    const tag = await dbStore.marketingSequenceTags.findOne(m.tagId);
    if (tag) tags.push(tag);
  }

  let folderName = null;
  if (sequence.folderId) {
    const folder = await dbStore.marketingSequenceFolders.findOne(
      sequence.folderId,
    );
    if (folder) folderName = folder.name;
  }

  return c.json({
    success: true,
    data: {
      ...sequence,
      folderName,
      tags,
    },
  });
});

sequencesApp.post("/:id/clone", tenantAuth, async (c) => {
  const originalId = c.req.param("id");
  const tenant = c.get("tenant");
  const body = await c.req.json().catch(() => ({}));
  const { name } = body;

  const originalSequence = await dbStore.marketingSequences.findOne(originalId);
  if (!originalSequence) {
    return c.json({ success: false, error: "Sequence not found" }, 404);
  }

  const newName = name || `${originalSequence.name} - Copy`;

  try {
    const cloned = await cloneMarketingSequence(
      dbStore,
      originalId,
      newName,
      tenant.orgId,
    );
    return c.json({ success: true, sequence: cloned });
  } catch (err) {
    const error = err as Error;
    return c.json({ success: false, error: error.message }, 400);
  }
});

sequencesApp.post("/:id/pause", tenantAuth, async (c) => {
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

sequencesApp.post("/:id/resume", tenantAuth, async (c) => {
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

sequencesApp.post("/:id/steps/:stepId/reorder", tenantAuth, async (c) => {
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

sequencesApp.delete("/:id/steps/:stepId", tenantAuth, async (c) => {
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

sequencesApp.post("/:id/archive", tenantAuth, async (c) => {
  const sequenceId = c.req.param("id");
  const tenant = c.get("tenant");

  const sequence = await dbStore.marketingSequences.findOne(sequenceId);
  if (!sequence) {
    return c.json({ success: false, error: "Sequence not found" }, 404);
  }

  try {
    const archived = await archiveMarketingSequence(
      dbStore,
      sequenceId,
      tenant.orgId,
    );
    return c.json({ success: true, sequence: archived });
  } catch (err) {
    const error = err as Error;
    return c.json({ success: false, error: error.message }, 400);
  }
});

sequencesApp.delete("/:id/purge", tenantAuth, async (c) => {
  const sequenceId = c.req.param("id");
  const tenant = c.get("tenant");

  const sequence = await dbStore.marketingSequences.findOne(sequenceId);
  if (!sequence) {
    return c.json({ success: false, error: "Sequence not found" }, 404);
  }

  try {
    await purgeMarketingSequence(dbStore, sequenceId, tenant.orgId);
    return c.json({ success: true, message: "Sequence purged successfully" });
  } catch (err) {
    const error = err as Error;
    return c.json({ success: false, error: error.message }, 400);
  }
});

sequencesApp.get("/:id/members/:memberId/logs", tenantAuth, async (c) => {
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
