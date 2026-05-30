import { genId } from "../_ids";
import { assertTenantOwns } from "../_rls";
import type { DBWebhookOutbox } from "../_store";
import { store } from "../_store";
import { getActiveOrgId } from "../_tenant";

export const webhookOutboxStore = {
  findMany: async () => {
    const orgId = getActiveOrgId();
    return store.webhookOutbox.filter((o) => o.orgId === orgId);
  },
  findOne: async (id: string) => {
    const orgId = getActiveOrgId();
    const o = store.webhookOutbox.find((x) => x.id === id);
    if (o && o.orgId !== orgId) return null;
    return o || null;
  },
  insert: async (o: Omit<DBWebhookOutbox, "id" | "createdAt">) => {
    const _orgId = getActiveOrgId();
    assertTenantOwns(o);
    const newOutbox: DBWebhookOutbox = {
      ...o,
      id: genId("outbox"),
      createdAt: new Date(),
    };
    store.webhookOutbox.push(newOutbox);
    return newOutbox;
  },
  update: async (
    id: string,
    updates: Partial<Omit<DBWebhookOutbox, "id" | "orgId" | "createdAt">>,
  ) => {
    const _orgId = getActiveOrgId();
    const index = store.webhookOutbox.findIndex((o) => o.id === id);
    if (index === -1) return null;
    assertTenantOwns(store.webhookOutbox[index]);
    store.webhookOutbox[index] = {
      ...store.webhookOutbox[index],
      ...updates,
    };
    return store.webhookOutbox[index];
  },
  delete: async (id: string) => {
    const _orgId = getActiveOrgId();
    const index = store.webhookOutbox.findIndex((o) => o.id === id);
    if (index === -1) return false;
    assertTenantOwns(store.webhookOutbox[index]);
    store.webhookOutbox.splice(index, 1);
    return true;
  },
};
