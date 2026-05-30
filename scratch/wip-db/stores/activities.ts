import { genId } from "../_ids";
import { assertTenantOwns } from "../_rls";
import type { DBActivity } from "../_store";
import { store } from "../_store";
import { getActiveOrgId } from "../_tenant";

export const activitiesStore = {
  findMany: async () => {
    const orgId = getActiveOrgId();
    return store.activities.filter((act) => act.orgId === orgId);
  },
  findOne: async (id: string) => {
    const orgId = getActiveOrgId();
    const act = store.activities.find((a) => a.id === id);
    if (act && act.orgId !== orgId) {
      return null;
    }
    return act || null;
  },
  insert: async (
    act: Omit<DBActivity, "id" | "createdAt"> & { createdAt?: Date },
  ) => {
    const _orgId = getActiveOrgId();
    assertTenantOwns(act);
    const newAct: DBActivity = {
      ...act,
      id: genId("activity"),
      createdAt: act.createdAt || new Date(),
    };
    store.activities.push(newAct);
    return newAct;
  },
};
