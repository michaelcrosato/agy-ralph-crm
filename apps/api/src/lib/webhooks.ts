import { dbStore, mockDb, withTenant } from "@crm/db";
import { enqueueOutboundWebhooks, processOutboxItems } from "@crm/webhooks";

/**
 * Fires outbound webhook notifications asynchronously to all active
 * subscriptions of the tenant. Processes the outbox immediately so
 * standard flows see the side-effects in the same request.
 */
export async function triggerOutboundWebhooks(
  orgId: string,
  event: string,
  payload: Record<string, unknown>,
): Promise<void> {
  await withTenant(orgId, mockDb, async () => {
    await enqueueOutboundWebhooks(orgId, event, payload, dbStore);
    processOutboxItems(orgId, dbStore).catch(() => {});
  });
}
