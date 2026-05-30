import { genId } from "../_ids";
import { assertTenantOwns } from "../_rls";
import type { DBLeadSlaTracker } from "../_store";
import { store } from "../_store";
import { getActiveOrgId } from "../_tenant";

export const leadSlaTrackersStore = {
  findMany: async () => {
    const orgId = getActiveOrgId();
    return store.leadSlaTrackers.filter((t) => t.orgId === orgId);
  },
  findOne: async (id: string) => {
    const orgId = getActiveOrgId();
    const t = store.leadSlaTrackers.find((x) => x.id === id);
    if (t && t.orgId !== orgId) return null;
    return t || null;
  },
  findForLead: async (leadId: string) => {
    const orgId = getActiveOrgId();
    return store.leadSlaTrackers.filter(
      (t) => t.leadId === leadId && t.orgId === orgId,
    );
  },
  insert: async (tracker: Omit<DBLeadSlaTracker, "id" | "createdAt">) => {
    const _orgId = getActiveOrgId();
    assertTenantOwns(tracker);
    const newTracker: DBLeadSlaTracker = {
      ...tracker,
      id: genId("tracker"),
      createdAt: new Date(),
    };
    store.leadSlaTrackers.push(newTracker);
    return newTracker;
  },
  update: async (
    id: string,
    updates: Partial<Omit<DBLeadSlaTracker, "id" | "orgId" | "createdAt">>,
  ) => {
    const _orgId = getActiveOrgId();
    const index = store.leadSlaTrackers.findIndex((t) => t.id === id);
    if (index === -1) return null;
    assertTenantOwns(store.leadSlaTrackers[index]);
    store.leadSlaTrackers[index] = {
      ...store.leadSlaTrackers[index],
      ...updates,
    };
    return store.leadSlaTrackers[index];
  },
};
