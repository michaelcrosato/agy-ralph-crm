import {
  dbStore,
  mockDb,
  pgDb,
  registerMutationListener,
  withTenant,
} from "@crm/db";
import { createLogger } from "@crm/observability";
import { createMockEmbeddingProvider } from "@crm/search";

const log = createLogger({ name: "embedder" });

export function getEmbeddingProvider() {
  const providerType = process.env.EMBEDDINGS_PROVIDER || "mock";
  if (providerType === "openai") {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      log.warn(
        "OPENAI_API_KEY missing. Falling back to mock embedding provider.",
      );
      return createMockEmbeddingProvider(1536);
    }
    return {
      dimensions: 1536,
      async embed(text: string): Promise<number[]> {
        const response = await fetch("https://api.openai.com/v1/embeddings", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            input: text,
            model: "text-embedding-3-small",
          }),
        });
        if (!response.ok) {
          throw new Error(`OpenAI API failed: ${response.statusText}`);
        }
        const body = (await response.json()) as any;
        return body.data[0].embedding;
      },
    };
  }
  return createMockEmbeddingProvider(1536);
}

export class EmbedderService {
  private static queue: {
    orgId: string;
    entityType: string;
    entityId: string;
    text: string;
  }[] = [];
  private static processing = false;
  private static initialized = false;

  public static initialize() {
    if (EmbedderService.initialized) return;
    EmbedderService.initialized = true;

    registerMutationListener((entityType, id, data) => {
      const type = entityType === "accounts" ? "Account" : "Contact";
      let text = "";
      if (type === "Account") {
        text = `Account Name: ${data.name} | Domain: ${data.domain || "N/A"}`;
      } else {
        text = `Contact Name: ${data.firstName ? `${data.firstName} ` : ""}${data.lastName} | Email: ${data.email || "N/A"}`;
      }

      EmbedderService.queue.push({
        orgId: data.orgId,
        entityType: type,
        entityId: id,
        text,
      });

      // Trigger queue processing asynchronously
      EmbedderService.processQueue().catch((err) => {
        log.error({ err }, "Embedder queue error");
      });
    });
  }

  private static async processQueue() {
    if (EmbedderService.processing) return;
    EmbedderService.processing = true;

    try {
      const provider = getEmbeddingProvider();

      while (EmbedderService.queue.length > 0) {
        const item = EmbedderService.queue.shift();
        if (!item) continue;

        try {
          const vector = await provider.embed(item.text);
          const activeDb = process.env.DB_DRIVER === "pg" ? pgDb : mockDb;

          await withTenant(item.orgId, activeDb, async () => {
            // Find if embedding already exists
            const existing = await dbStore.embeddings.findMany();
            const found = existing.find(
              (e: any) =>
                e.entityType === item.entityType &&
                e.entityId === item.entityId &&
                e.orgId === item.orgId,
            );

            if (found) {
              await dbStore.embeddings.update(found.id, {
                embedding: vector,
              });
            } else {
              await dbStore.embeddings.insert({
                orgId: item.orgId,
                entityType: item.entityType,
                entityId: item.entityId,
                embedding: vector,
              });
            }
          });
        } catch (err) {
          log.error(
            { err, entityType: item.entityType, entityId: item.entityId },
            "Failed to generate embedding",
          );
        }
      }
    } finally {
      EmbedderService.processing = false;
    }
  }

  public static getQueueLength() {
    return EmbedderService.queue.length;
  }

  // Clear helper for tests
  public static clearQueue() {
    EmbedderService.queue = [];
    EmbedderService.processing = false;
  }
}
