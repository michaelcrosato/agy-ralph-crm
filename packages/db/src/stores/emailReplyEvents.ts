import { genId } from "../_ids";
import { assertTenantOwns } from "../_rls";
import type { DBEmailReplyEvent } from "../_store";
import { store } from "../_store";
import { getActiveOrgId } from "../_tenant";

export const emailReplyEventsStore = {
  findMany: async () => {
    const orgId = getActiveOrgId();
    return store.emailReplyEvents.filter((c) => c.orgId === orgId);
  },
  findForTracker: async (trackerId: string) => {
    const orgId = getActiveOrgId();
    return store.emailReplyEvents.filter(
      (c) => c.trackerId === trackerId && c.orgId === orgId,
    );
  },
  findOne: async (id: string) => {
    const orgId = getActiveOrgId();
    const m = store.emailReplyEvents.find((x) => x.id === id);
    if (m && m.orgId !== orgId) return null;
    return m || null;
  },
  insert: async (item: Omit<DBEmailReplyEvent, "id" | "createdAt">) => {
    const _orgId = getActiveOrgId();
    assertTenantOwns(item);
    const newItem: DBEmailReplyEvent = {
      ...item,
      id: genId("rep"),
      createdAt: new Date(),
    };
    store.emailReplyEvents.push(newItem);
    return newItem;
  },
};
