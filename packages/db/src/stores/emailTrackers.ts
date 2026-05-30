import { genId } from "../_ids";
import { assertTenantOwns } from "../_rls";
import type { DBEmailTracker } from "../_store";
import { store } from "../_store";
import { getActiveOrgId } from "../_tenant";

export const emailTrackersStore = {
  findMany: async () => {
    const orgId = getActiveOrgId();
    return store.emailTrackers.filter((t) => t.orgId === orgId);
  },
  findOne: async (id: string) => {
    const orgId = getActiveOrgId();
    const t = store.emailTrackers.find((x) => x.id === id);
    if (t && t.orgId !== orgId) return null;
    return t || null;
  },
  findByToken: async (token: string) => {
    return store.emailTrackers.find((x) => x.token === token) || null;
  },
  insert: async (
    t: Omit<
      DBEmailTracker,
      | "id"
      | "openCount"
      | "clickCount"
      | "replyCount"
      | "bounceCount"
      | "totalReadTimeMs"
      | "lastReadClassification"
      | "lastOpenedAt"
      | "lastClickedAt"
      | "lastRepliedAt"
      | "lastBouncedAt"
      | "createdAt"
      | "updatedAt"
    >,
  ) => {
    const _orgId = getActiveOrgId();
    assertTenantOwns(t);
    const newTracker: DBEmailTracker = {
      ...t,
      id: genId("tracker"),
      openCount: 0,
      clickCount: 0,
      replyCount: 0,
      bounceCount: 0,
      totalReadTimeMs: 0,
      lastReadClassification: null,
      lastOpenedAt: null,
      lastClickedAt: null,
      lastRepliedAt: null,
      lastBouncedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    store.emailTrackers.push(newTracker);
    return newTracker;
  },
  update: async (
    id: string,
    updates: Partial<
      Omit<
        DBEmailTracker,
        "id" | "orgId" | "activityId" | "token" | "createdAt" | "updatedAt"
      >
    >,
  ) => {
    const _orgId = getActiveOrgId();
    const index = store.emailTrackers.findIndex((x) => x.id === id);
    if (index === -1) return null;
    assertTenantOwns(store.emailTrackers[index]);
    store.emailTrackers[index] = {
      ...store.emailTrackers[index],
      ...updates,
      updatedAt: new Date(),
    };
    return store.emailTrackers[index];
  },
  updatePublic: async (
    id: string,
    updates: Partial<
      Pick<
        DBEmailTracker,
        | "openCount"
        | "clickCount"
        | "replyCount"
        | "bounceCount"
        | "totalReadTimeMs"
        | "lastReadClassification"
        | "lastOpenedAt"
        | "lastClickedAt"
        | "lastRepliedAt"
        | "lastBouncedAt"
        | "updatedAt"
      >
    >,
  ) => {
    const index = store.emailTrackers.findIndex((x) => x.id === id);
    if (index === -1) return null;
    store.emailTrackers[index] = {
      ...store.emailTrackers[index],
      ...updates,
      updatedAt: new Date(),
    };
    return store.emailTrackers[index];
  },
  delete: async (id: string) => {
    const _orgId = getActiveOrgId();
    const index = store.emailTrackers.findIndex((x) => x.id === id);
    if (index === -1) return false;
    assertTenantOwns(store.emailTrackers[index]);
    store.emailTrackers.splice(index, 1);
    return true;
  },
};
