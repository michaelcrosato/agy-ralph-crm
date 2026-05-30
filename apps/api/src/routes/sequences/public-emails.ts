import {
  handleEmailDeliveryEvent,
  parseUtmParams,
  processSequenceEmailOpen,
  processSequenceEmailReply,
  processSequenceLinkClick,
} from "@crm/core";
import { dbStore, mockDb, withTenant } from "@crm/db";
import { Hono } from "hono";
import type { Env } from "../../middleware/tenantAuth";
import {
  recalculateEngagementScoreByTrackerToken,
  recalculateMemberEngagementScore,
} from "./helpers";

export const publicEmailsApp = new Hono<Env>();

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
