import * as crypto from "node:crypto";
import type {
  DBAuditLog,
  DBWebhook,
  DBWebhookDelivery,
  DBWebhookDlq,
  DBWebhookOutbox,
} from "@crm/db";

export const WEBHOOKS_VERSION = "0.1.0";

export interface WebhookDBStore {
  webhooks: {
    findMany: () => Promise<DBWebhook[]>;
  };
  webhookOutbox: {
    findMany: () => Promise<DBWebhookOutbox[]>;
    insert: (
      o: Omit<DBWebhookOutbox, "id" | "createdAt">,
    ) => Promise<DBWebhookOutbox>;
    update: (
      id: string,
      updates: Partial<Omit<DBWebhookOutbox, "id" | "orgId" | "createdAt">>,
    ) => Promise<DBWebhookOutbox | null>;
    delete: (id: string) => Promise<boolean>;
  };
  webhookDlq: {
    insert: (d: Omit<DBWebhookDlq, "id" | "failedAt">) => Promise<DBWebhookDlq>;
  };
  webhookDeliveries: {
    insert: (
      d: Omit<DBWebhookDelivery, "id" | "createdAt">,
    ) => Promise<DBWebhookDelivery>;
  };
  auditLogs: {
    insert: (l: Omit<DBAuditLog, "id" | "createdAt">) => Promise<DBAuditLog>;
  };
}

// Computes HMAC-SHA256 signature for payload verification
export function computeHmacSignature(payload: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

// Simulates sending an outbound webhook asynchronously, signing it if a secret exists
export async function simulateWebhookDispatch(params: {
  targetUrl: string;
  secret: string | null;
  event: string;
  payload: Record<string, unknown>;
}): Promise<{
  statusCode: number;
  payloadString: string;
  signature: string | null;
}> {
  const payloadString = JSON.stringify({
    event: params.event,
    timestamp: new Date().toISOString(),
    data: params.payload,
  });

  let signature: string | null = null;
  if (params.secret) {
    signature = computeHmacSignature(payloadString, params.secret);
  }

  // If the targetUrl contains the word "fail", simulate a down-stream delivery failure (HTTP 500)
  const statusCode = params.targetUrl.includes("fail") ? 500 : 200;

  return {
    statusCode,
    payloadString,
    signature,
  };
}

// Enqueues outbound webhook payloads into the database-driven outbox store
export async function enqueueOutboundWebhooks(
  orgId: string,
  event: string,
  payload: Record<string, unknown>,
  dbStoreInstance: WebhookDBStore,
): Promise<void> {
  const webhooks = await dbStoreInstance.webhooks.findMany().catch(() => []);
  const activeSubs = webhooks.filter((w) => w.status === "active");

  for (const sub of activeSubs) {
    await dbStoreInstance.webhookOutbox.insert({
      orgId,
      webhookId: sub.id,
      event,
      payload: JSON.stringify(payload),
      status: "pending",
      attempts: 0,
      lastAttemptAt: null,
      nextAttemptAt: new Date(),
      lastError: null,
    });
  }
}

// Processes pending/failed webhook outbox items, executing them and handling retries/DLQ movements
export async function processOutboxItems(
  orgId: string,
  dbStoreInstance: WebhookDBStore,
): Promise<{ successes: number; failures: number; dlqTransitions: number }> {
  let successes = 0;
  let failures = 0;
  let dlqTransitions = 0;

  // Retrieve active tenant outbox entries
  const outboxItems = await dbStoreInstance.webhookOutbox
    .findMany()
    .catch(() => []);
  const eligibleItems = outboxItems.filter((item) => {
    const isPendingOrFailed =
      item.status === "pending" || item.status === "failed";
    const isDue = new Date(item.nextAttemptAt).getTime() <= Date.now();
    return isPendingOrFailed && isDue;
  });

  // Also prefetch webhooks to avoid repeatedly querying
  const webhooks = await dbStoreInstance.webhooks.findMany().catch(() => []);

  for (const entry of eligibleItems) {
    const webhook = webhooks.find((w) => w.id === entry.webhookId);
    if (!webhook || webhook.status !== "active") {
      // Clean up orphaned or inactive webhook outbox items
      await dbStoreInstance.webhookOutbox.delete(entry.id).catch(() => {});
      continue;
    }

    // Set to processing
    await dbStoreInstance.webhookOutbox
      .update(entry.id, { status: "processing" })
      .catch(() => {});

    let payloadObj: Record<string, unknown>;
    try {
      payloadObj = JSON.parse(entry.payload);
    } catch {
      payloadObj = { raw: entry.payload };
    }

    try {
      const result = await simulateWebhookDispatch({
        targetUrl: webhook.targetUrl,
        secret: webhook.secret,
        event: entry.event,
        payload: payloadObj,
      });

      if (result.statusCode === 200) {
        // Success: Log delivery history and remove from outbox
        await dbStoreInstance.webhookDeliveries.insert({
          orgId,
          webhookId: webhook.id,
          event: entry.event,
          statusCode: result.statusCode,
          payload: result.payloadString,
        });

        await dbStoreInstance.webhookOutbox.delete(entry.id);
        successes++;
      } else {
        // HTTP Failure: Handle retry logic or DLQ
        const nextAttempts = entry.attempts + 1;
        const errorMessage = `HTTP status ${result.statusCode}`;

        // Insert failed delivery log
        await dbStoreInstance.webhookDeliveries.insert({
          orgId,
          webhookId: webhook.id,
          event: entry.event,
          statusCode: result.statusCode,
          payload: result.payloadString,
        });

        if (nextAttempts >= 5) {
          // Transition to Dead Letter Queue (DLQ)
          await dbStoreInstance.webhookDlq.insert({
            orgId,
            webhookId: webhook.id,
            event: entry.event,
            payload: entry.payload,
            attempts: nextAttempts,
            lastError: errorMessage,
          });

          // Log system audit log failure record
          const systemUserId = "user-00000000-0000-0000-0000-000000000000";
          await dbStoreInstance.auditLogs
            .insert({
              orgId,
              recordId: webhook.id,
              recordType: "webhook",
              action: "dlq_transition",
              userId: systemUserId,
              changes: {
                status: { before: "outbox", after: "dlq" },
                attempts: { before: entry.attempts, after: nextAttempts },
                lastError: { before: entry.lastError, after: errorMessage },
              },
            })
            .catch(() => {});

          await dbStoreInstance.webhookOutbox.delete(entry.id);
          dlqTransitions++;
        } else {
          // Calculate exponential backoff (2^attempts seconds)
          const backoffSec = 2 ** nextAttempts;
          const nextAttemptDate = new Date(Date.now() + backoffSec * 1000);

          await dbStoreInstance.webhookOutbox.update(entry.id, {
            status: "failed",
            attempts: nextAttempts,
            lastAttemptAt: new Date(),
            nextAttemptAt: nextAttemptDate,
            lastError: errorMessage,
          });

          failures++;
        }
      }
    } catch (err) {
      // General Execution Exception: Handle like a failure
      const nextAttempts = entry.attempts + 1;
      const errorMessage =
        err instanceof Error ? err.message : "Execution exception";

      await dbStoreInstance.webhookDeliveries.insert({
        orgId,
        webhookId: webhook.id,
        event: entry.event,
        statusCode: 500,
        payload: JSON.stringify({ error: errorMessage }),
      });

      if (nextAttempts >= 5) {
        await dbStoreInstance.webhookDlq.insert({
          orgId,
          webhookId: webhook.id,
          event: entry.event,
          payload: entry.payload,
          attempts: nextAttempts,
          lastError: errorMessage,
        });

        const systemUserId = "user-00000000-0000-0000-0000-000000000000";
        await dbStoreInstance.auditLogs
          .insert({
            orgId,
            recordId: webhook.id,
            recordType: "webhook",
            action: "dlq_transition",
            userId: systemUserId,
            changes: {
              status: { before: "outbox", after: "dlq" },
              attempts: { before: entry.attempts, after: nextAttempts },
              lastError: { before: entry.lastError, after: errorMessage },
            },
          })
          .catch(() => {});

        await dbStoreInstance.webhookOutbox.delete(entry.id);
        dlqTransitions++;
      } else {
        const backoffSec = 2 ** nextAttempts;
        const nextAttemptDate = new Date(Date.now() + backoffSec * 1000);

        await dbStoreInstance.webhookOutbox.update(entry.id, {
          status: "failed",
          attempts: nextAttempts,
          lastAttemptAt: new Date(),
          nextAttemptAt: nextAttemptDate,
          lastError: errorMessage,
        });

        failures++;
      }
    }
  }

  return { successes, failures, dlqTransitions };
}
