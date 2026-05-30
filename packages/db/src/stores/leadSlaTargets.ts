import { genId } from "../_ids";
import { assertTenantOwns } from "../_rls";
import type { DBLeadSlaTarget } from "../_store";
import { store } from "../_store";
import { getActiveOrgId } from "../_tenant";

export const leadSlaTargetsStore = {
  findMany: async () => {
    const orgId = getActiveOrgId();
    return store.leadSlaTargets.filter((t) => t.orgId === orgId);
  },
  findOne: async (id: string) => {
    const orgId = getActiveOrgId();
    const t = store.leadSlaTargets.find((x) => x.id === id);
    if (t && t.orgId !== orgId) return null;
    return t || null;
  },
  insert: async (target: Omit<DBLeadSlaTarget, "id" | "createdAt">) => {
    const _orgId = getActiveOrgId();
    assertTenantOwns(target);
    const newTarget: DBLeadSlaTarget = {
      ...target,
      id: genId("target"),
      createdAt: new Date(),
    };
    store.leadSlaTargets.push(newTarget);
    return newTarget;
  },
  update: async (
    id: string,
    updates: Partial<Omit<DBLeadSlaTarget, "id" | "orgId" | "createdAt">>,
  ) => {
    const _orgId = getActiveOrgId();
    const index = store.leadSlaTargets.findIndex((t) => t.id === id);
    if (index === -1) return null;
    assertTenantOwns(store.leadSlaTargets[index]);
    store.leadSlaTargets[index] = {
      ...store.leadSlaTargets[index],
      ...updates,
    };
    return store.leadSlaTargets[index];
  },
};
