import { genId } from "../_ids";
import { assertTenantOwns } from "../_rls";
import type { DBEmailBounceEvent } from "../_store";
import { store } from "../_store";
import { getActiveOrgId } from "../_tenant";

export const emailBounceEventsStore = {
  findMany: async () => {
    const orgId = getActiveOrgId();
    return store.emailBounceEvents.filter((c) => c.orgId === orgId);
  },
  findForTracker: async (trackerId: string) => {
    const orgId = getActiveOrgId();
    return store.emailBounceEvents.filter(
      (c) => c.trackerId === trackerId && c.orgId === orgId,
    );
  },
  findOne: async (id: string) => {
    const orgId = getActiveOrgId();
    const m = store.emailBounceEvents.find((x) => x.id === id);
    if (m && m.orgId !== orgId) return null;
    return m || null;
  },
  insert: async (item: Omit<DBEmailBounceEvent, "id" | "createdAt">) => {
    const _orgId = getActiveOrgId();
    assertTenantOwns(item);
    const newItem: DBEmailBounceEvent = {
      ...item,
      id: genId("bnc"),
      createdAt: new Date(),
    };
    store.emailBounceEvents.push(newItem);
    return newItem;
  },
};
