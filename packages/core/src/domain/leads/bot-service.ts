import {
  dbStore,
  mockDb,
  pgDb,
  registerMutationListener,
  withTenant,
} from "@crm/db";
import { createLogger } from "@crm/observability";
import { evaluateBantState } from "./bot";

const log = createLogger({ name: "conversational-bot" });

export class ConversationalBotService {
  private static queue: {
    orgId: string;
    leadId: string;
  }[] = [];
  private static processing = false;
  private static initialized = false;
  private static recentlyProcessed = new Set<string>();
  private static activePromises = new Map<string, Promise<any>>();

  public static initialize() {
    if (ConversationalBotService.initialized) return;
    ConversationalBotService.initialized = true;

    // Listen to store mutations
    registerMutationListener((entityType, id, data) => {
      // Check if activityLinks mutation is recorded and linked to a Lead
      if (entityType === "activityLinks" && data.targetType === "Lead") {
        const leadId = data.targetId;
        const orgId = data.orgId;
        const lockKey = `${orgId}:${leadId}`;

        if (ConversationalBotService.recentlyProcessed.has(lockKey)) {
          return;
        }

        log.info(
          { leadId },
          "Inbound activity link detected. Enqueuing Lead for bot qualification.",
        );
        ConversationalBotService.queue.push({ orgId, leadId });

        ConversationalBotService.processQueue().catch((err) => {
          log.error({ err }, "Bot qualification processing error");
        });
      }
    });
  }

  public static async qualifyLead(leadId: string, orgId: string): Promise<any> {
    const lockKey = `${orgId}:${leadId}`;
    if (ConversationalBotService.activePromises.has(lockKey)) {
      return ConversationalBotService.activePromises.get(lockKey);
    }

    const activeDb = process.env.DB_DRIVER === "pg" ? pgDb : mockDb;

    const promise = withTenant(orgId, activeDb, async () => {
      const lead = await dbStore.leads.findOne(leadId);
      if (!lead) {
        throw new Error(`Lead not found with ID ${leadId}`);
      }

      // Fetch all activity links associated with this lead
      const allLinks = await dbStore.activityLinks.findMany();
      const leadLinks = allLinks.filter(
        (link) => link.targetType === "Lead" && link.targetId === leadId,
      );

      // Fetch all linked activities
      const activities: any[] = [];
      for (const link of leadLinks) {
        const activity = await dbStore.activities.findOne(link.activityId);
        if (activity) {
          activities.push(activity);
        }
      }

      // Sort activities in chronological order
      activities.sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      );

      // Run offline BANT analysis
      const bant = evaluateBantState(activities);

      // Synthesize custom BANT parameters into lead custom fields
      const custom = {
        ...(lead.custom || {}),
        bantBudget: bant.bantBudget,
        bantAuthority: bant.bantAuthority,
        bantNeed: bant.bantNeed,
        bantTimeline: bant.bantTimeline,
        bantScore: bant.bantScore,
        botQualificationStatus: bant.botQualificationStatus,
        botNextQuery: bant.botNextQuery,
        botNotes: bant.botNotes,
      };

      ConversationalBotService.recentlyProcessed.add(lockKey);

      try {
        // Automatically convert status to Qualified/Disqualified based on criteria
        let status = lead.status;
        if (bant.botQualificationStatus === "qualified") {
          status = "Qualified";
        } else if (bant.botQualificationStatus === "unqualified") {
          status = "Disqualified";
        }

        const updated = await dbStore.leads.update(leadId, { custom, status });

        // If the bot needs more info AND the last message was inbound (simulated by non-owner creators),
        // we automatically generate the bot's simulated outbound reply!
        if (
          bant.botQualificationStatus === "needs_more_info" &&
          activities.length > 0
        ) {
          const lastActivity = activities[activities.length - 1];
          const isLastActivityInbound =
            lastActivity.creatorId === "lead" ||
            lastActivity.creatorId === null ||
            lastActivity.creatorId === "";

          if (isLastActivityInbound && bant.botNextQuery) {
            log.info(
              { leadId },
              "Last activity was inbound. Bot generating reply.",
            );

            // Create bot outbound activity in db
            const botActivity = await dbStore.activities.insert({
              orgId,
              creatorId: lead.ownerId, // Outbound is sent on behalf of lead owner
              type: lastActivity.type === "sms" ? "sms" : "email",
              subject:
                lastActivity.type === "sms"
                  ? "Re: SMS Chat"
                  : `Re: CRM Inquiry`,
              body: bant.botNextQuery,
              dueDate: null,
            });

            // Create link linking outbound reply to lead
            await dbStore.activityLinks.insert({
              orgId,
              activityId: botActivity.id,
              targetType: "Lead",
              targetId: leadId,
            });
          }
        }

        return updated;
      } finally {
        setTimeout(() => {
          ConversationalBotService.recentlyProcessed.delete(lockKey);
        }, 50);
      }
    });

    ConversationalBotService.activePromises.set(lockKey, promise);

    try {
      return await promise;
    } finally {
      ConversationalBotService.activePromises.delete(lockKey);
    }
  }

  private static async processQueue() {
    if (ConversationalBotService.processing) return;
    ConversationalBotService.processing = true;

    try {
      while (ConversationalBotService.queue.length > 0) {
        const item = ConversationalBotService.queue.shift();
        if (!item) continue;

        try {
          await ConversationalBotService.qualifyLead(item.leadId, item.orgId);
        } catch (error) {
          log.error(
            { error, leadId: item.leadId },
            "Failed to qualify lead inside queue",
          );
        }
      }
    } finally {
      ConversationalBotService.processing = false;
    }
  }
}
