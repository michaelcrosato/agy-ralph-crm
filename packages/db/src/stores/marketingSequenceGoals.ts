import { genId } from "../_ids";
import { assertTenantOwns } from "../_rls";
import type { DBMarketingSequenceGoal } from "../_store";
import { store } from "../_store";
import { getActiveOrgId } from "../_tenant";

export const marketingSequenceGoalsStore = {
  findMany: async () => {
    const orgId = getActiveOrgId();
    return store.marketingSequenceGoals.filter((c) => c.orgId === orgId);
  },
  findForSequence: async (sequenceId: string) => {
    const orgId = getActiveOrgId();
    return store.marketingSequenceGoals.filter(
      (m) => m.sequenceId === sequenceId && m.orgId === orgId,
    );
  },
  findOne: async (id: string) => {
    const orgId = getActiveOrgId();
    const m = store.marketingSequenceGoals.find((x) => x.id === id);
    if (m && m.orgId !== orgId) return null;
    return m || null;
  },
  insert: async (
    item: Omit<DBMarketingSequenceGoal, "id" | "createdAt" | "updatedAt">,
  ) => {
    const _orgId = getActiveOrgId();
    assertTenantOwns(item);
    const newItem: DBMarketingSequenceGoal = {
      ...item,
      id: genId("goal"),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    store.marketingSequenceGoals.push(newItem);
    return newItem;
  },
  delete: async (id: string) => {
    const _orgId = getActiveOrgId();
    const index = store.marketingSequenceGoals.findIndex((c) => c.id === id);
    if (index === -1) return false;
    assertTenantOwns(store.marketingSequenceGoals[index]);
    store.marketingSequenceGoals.splice(index, 1);
    return true;
  },
};
