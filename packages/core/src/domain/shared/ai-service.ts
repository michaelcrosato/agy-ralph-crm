import {
  dbStore,
  mockDb,
  pgDb,
  registerMutationListener,
  withTenant,
} from "@crm/db";
import { createLogger } from "@crm/observability";
import { enrichRecordAttributes } from "./ai";

const log = createLogger({ name: "ai-enrichment" });

export class AIAttributeService {
  private static queue: {
    orgId: string;
    entityType: string;
    entityId: string;
    record: any;
  }[] = [];
  private static processing = false;
  private static initialized = false;
  private static recentlyEnriched = new Set<string>();

  public static initialize() {
    if (AIAttributeService.initialized) return;
    AIAttributeService.initialized = true;

    registerMutationListener((entityType, id, data) => {
      // We only enrich "leads" and "contacts"
      const type =
        entityType === "leads"
          ? "Lead"
          : entityType === "contacts"
            ? "Contact"
            : null;
      if (!type) return;

      const lockKey = `${type}:${id}`;
      if (AIAttributeService.recentlyEnriched.has(lockKey)) {
        return;
      }

      log.info({ type, id }, "Enqueuing record for AI attributes enrichment");
      AIAttributeService.queue.push({
        orgId: data.orgId,
        entityType: type,
        entityId: id,
        record: data,
      });

      AIAttributeService.processQueue().catch((err) => {
        log.error({ err }, "AI enrichment queue error");
      });
    });
  }

  public static async enrichRecord(
    entityType: string,
    id: string,
    orgId: string,
  ): Promise<any> {
    const activeDb = process.env.DB_DRIVER === "pg" ? pgDb : mockDb;
    const type = entityType.toLowerCase();

    return await withTenant(orgId, activeDb, async () => {
      let record: any = null;
      let store: any = null;

      if (type === "lead") {
        store = dbStore.leads;
      } else if (type === "contact") {
        store = dbStore.contacts;
      } else {
        throw new Error(`Unsupported entity type: ${entityType}`);
      }

      record = await store.findOne(id);
      if (!record) {
        throw new Error(`${entityType} not found with ID ${id}`);
      }

      const enriched = enrichRecordAttributes(entityType, record);
      const custom = {
        ...(record.custom || {}),
        aiSummary: enriched.aiSummary,
        icpScore: enriched.icpScore,
        competitorMentions: enriched.competitorMentions,
      };

      const lockKey = `${entityType === "lead" ? "Lead" : "Contact"}:${id}`;
      AIAttributeService.recentlyEnriched.add(lockKey);

      try {
        const updated = await store.update(id, { custom });
        return updated;
      } finally {
        setTimeout(() => {
          AIAttributeService.recentlyEnriched.delete(lockKey);
        }, 50);
      }
    });
  }

  private static async processQueue() {
    if (AIAttributeService.processing) return;
    AIAttributeService.processing = true;

    try {
      while (AIAttributeService.queue.length > 0) {
        const item = AIAttributeService.queue.shift();
        if (!item) continue;

        log.info(
          { entityType: item.entityType, entityId: item.entityId },
          "Processing AI enrichment queue item",
        );

        try {
          const activeDb = process.env.DB_DRIVER === "pg" ? pgDb : mockDb;
          await withTenant(item.orgId, activeDb, async () => {
            let store: any = null;
            if (item.entityType === "Lead") {
              store = dbStore.leads;
            } else if (item.entityType === "Contact") {
              store = dbStore.contacts;
            }

            if (!store) {
              log.warn(
                { entityType: item.entityType },
                "Store not found for type during AI enrichment",
              );
              return;
            }

            // Fetch latest record state
            const record = await store.findOne(item.entityId);
            if (!record) {
              log.warn(
                { entityId: item.entityId },
                "Record not found in store during AI enrichment",
              );
              return;
            }

            const enriched = enrichRecordAttributes(item.entityType, record);
            const custom = {
              ...(record.custom || {}),
              aiSummary: enriched.aiSummary,
              icpScore: enriched.icpScore,
              competitorMentions: enriched.competitorMentions,
            };

            const lockKey = `${item.entityType}:${item.entityId}`;
            AIAttributeService.recentlyEnriched.add(lockKey);

            try {
              await store.update(item.entityId, { custom });
              log.info(
                { entityType: item.entityType, entityId: item.entityId },
                "Record AI enriched successfully",
              );
            } finally {
              setTimeout(() => {
                AIAttributeService.recentlyEnriched.delete(lockKey);
              }, 50);
            }
          });
        } catch (error) {
          log.error(
            { error, entityType: item.entityType, entityId: item.entityId },
            "AI enrichment failed for queue item",
          );
        }
      }
    } finally {
      AIAttributeService.processing = false;
    }
  }
}
