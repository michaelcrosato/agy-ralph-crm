import { genId } from "../_ids";
import { assertTenantOwns } from "../_rls";
import type { DBEmailUnsubscribe } from "../_store";
import { store } from "../_store";
import { getActiveOrgId } from "../_tenant";

export const emailUnsubscribesStore = {
  findMany: async () => {
    const orgId = getActiveOrgId();
    return store.emailUnsubscribes.filter((c) => c.orgId === orgId);
  },
  findOne: async (id: string) => {
    const orgId = getActiveOrgId();
    const m = store.emailUnsubscribes.find((x) => x.id === id);
    if (m && m.orgId !== orgId) return null;
    return m || null;
  },
  insert: async (item: Omit<DBEmailUnsubscribe, "id" | "createdAt">) => {
    const _orgId = getActiveOrgId();
    assertTenantOwns(item);
    const newItem: DBEmailUnsubscribe = {
      ...item,
      id: genId("unsub"),
      createdAt: new Date(),
    };
    store.emailUnsubscribes.push(newItem);
    return newItem;
  },
};
