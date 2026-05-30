import { genId } from "../_ids";
import { assertTenantOwns } from "../_rls";
import type { DBEmailReadTimeEvent } from "../_store";
import { store } from "../_store";
import { getActiveOrgId } from "../_tenant";

export const emailReadTimeEventsStore = {
  findMany: async () => {
    const orgId = getActiveOrgId();
    return store.emailReadTimeEvents.filter((c) => c.orgId === orgId);
  },
  findForTracker: async (trackerId: string) => {
    const orgId = getActiveOrgId();
    return store.emailReadTimeEvents.filter(
      (c) => c.trackerId === trackerId && c.orgId === orgId,
    );
  },
  findOne: async (id: string) => {
    const orgId = getActiveOrgId();
    const m = store.emailReadTimeEvents.find((x) => x.id === id);
    if (m && m.orgId !== orgId) return null;
    return m || null;
  },
  insert: async (item: Omit<DBEmailReadTimeEvent, "id" | "createdAt">) => {
    const _orgId = getActiveOrgId();
    assertTenantOwns(item);
    const newItem: DBEmailReadTimeEvent = {
      ...item,
      id: genId("rdt"),
      createdAt: new Date(),
    };
    store.emailReadTimeEvents.push(newItem);
    return newItem;
  },
};
