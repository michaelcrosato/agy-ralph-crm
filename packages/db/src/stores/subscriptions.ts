import { genId } from "../_ids";
import { assertTenantOwns } from "../_rls";
import type { DBSubscription } from "../_store";
import { store } from "../_store";
import { getActiveOrgId } from "../_tenant";

export const subscriptionsStore = {
  findMany: async () => {
    const orgId = getActiveOrgId();
    return store.subscriptions.filter((s) => s.orgId === orgId);
  },
  findOne: async (id: string) => {
    const orgId = getActiveOrgId();
    const s = store.subscriptions.find((x) => x.id === id);
    if (s && s.orgId !== orgId) return null;
    return s || null;
  },
  insert: async (sub: Omit<DBSubscription, "id">) => {
    const _orgId = getActiveOrgId();
    assertTenantOwns(sub);
    const newSub: DBSubscription = {
      ...sub,
      id: genId("subscription"),
    };
    store.subscriptions.push(newSub);
    return newSub;
  },
  update: async (
    id: string,
    updates: Partial<Omit<DBSubscription, "id" | "orgId">>,
  ) => {
    const _orgId = getActiveOrgId();
    const index = store.subscriptions.findIndex((s) => s.id === id);
    if (index === -1) return null;
    assertTenantOwns(store.subscriptions[index]);
    store.subscriptions[index] = {
      ...store.subscriptions[index],
      ...updates,
    };
    return store.subscriptions[index];
  },
};
