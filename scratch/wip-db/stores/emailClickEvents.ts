import { genId } from "../_ids";
import { assertTenantOwns } from "../_rls";
import type { DBEmailClickEvent } from "../_store";
import { store } from "../_store";
import { getActiveOrgId } from "../_tenant";

export const emailClickEventsStore = {
  findMany: async () => {
    const orgId = getActiveOrgId();
    return store.emailClickEvents.filter((c) => c.orgId === orgId);
  },
  findForTracker: async (trackerId: string) => {
    const orgId = getActiveOrgId();
    return store.emailClickEvents.filter(
      (c) => c.trackerId === trackerId && c.orgId === orgId,
    );
  },
  findOne: async (id: string) => {
    const orgId = getActiveOrgId();
    const m = store.emailClickEvents.find((x) => x.id === id);
    if (m && m.orgId !== orgId) return null;
    return m || null;
  },
  insert: async (item: Omit<DBEmailClickEvent, "id" | "createdAt">) => {
    const _orgId = getActiveOrgId();
    assertTenantOwns(item);
    const newItem: DBEmailClickEvent = {
      ...item,
      id: genId("ev"),
      createdAt: new Date(),
    };
    store.emailClickEvents.push(newItem);
    return newItem;
  },
};
