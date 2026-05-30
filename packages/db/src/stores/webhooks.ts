import { genId } from "../_ids";
import { assertTenantOwns } from "../_rls";
import type { DBWebhook } from "../_store";
import { store } from "../_store";
import { getActiveOrgId } from "../_tenant";

export const webhooksStore = {
  findMany: async () => {
    const orgId = getActiveOrgId();
    return store.webhooks.filter((w) => w.orgId === orgId);
  },
  insert: async (webhook: Omit<DBWebhook, "id">) => {
    const _orgId = getActiveOrgId();
    assertTenantOwns(webhook);
    const newWebhook: DBWebhook = {
      ...webhook,
      id: genId("webhook"),
    };
    store.webhooks.push(newWebhook);
    return newWebhook;
  },
};
