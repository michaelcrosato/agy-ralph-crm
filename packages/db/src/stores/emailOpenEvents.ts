import { genId } from "../_ids";
import { assertTenantOwns } from "../_rls";
import type { DBEmailOpenEvent } from "../_store";
import { store } from "../_store";
import { getActiveOrgId } from "../_tenant";

export const emailOpenEventsStore = {
  findMany: async () => {
    const orgId = getActiveOrgId();
    return store.emailOpenEvents.filter((c) => c.orgId === orgId);
  },
  findForTracker: async (trackerId: string) => {
    const orgId = getActiveOrgId();
    return store.emailOpenEvents.filter(
      (c) => c.trackerId === trackerId && c.orgId === orgId,
    );
  },
  findOne: async (id: string) => {
    const orgId = getActiveOrgId();
    const m = store.emailOpenEvents.find((x) => x.id === id);
    if (m && m.orgId !== orgId) return null;
    return m || null;
  },
  insert: async (item: Omit<DBEmailOpenEvent, "id" | "createdAt">) => {
    const _orgId = getActiveOrgId();
    assertTenantOwns(item);
    const newItem: DBEmailOpenEvent = {
      ...item,
      id: genId("op"),
      createdAt: new Date(),
    };
    store.emailOpenEvents.push(newItem);
    return newItem;
  },
};
