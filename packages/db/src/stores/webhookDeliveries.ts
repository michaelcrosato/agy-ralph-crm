import { genId } from "../_ids";
import { assertTenantOwns } from "../_rls";
import type { DBWebhookDelivery } from "../_store";
import { store } from "../_store";
import { getActiveOrgId } from "../_tenant";

export const webhookDeliveriesStore = {
  findMany: async () => {
    const orgId = getActiveOrgId();
    return store.webhookDeliveries.filter((d) => d.orgId === orgId);
  },
  insert: async (delivery: Omit<DBWebhookDelivery, "id" | "createdAt">) => {
    const _orgId = getActiveOrgId();
    assertTenantOwns(delivery);
    const newDelivery: DBWebhookDelivery = {
      ...delivery,
      id: genId("delivery"),
      createdAt: new Date(),
    };
    store.webhookDeliveries.push(newDelivery);
    return newDelivery;
  },
};
