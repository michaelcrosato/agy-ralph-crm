import { genId } from "../_ids";
import { assertTenantOwns } from "../_rls";
import type { DBMarketingSequenceScoreTrigger } from "../_store";
import { store } from "../_store";
import { getActiveOrgId } from "../_tenant";

export const marketingSequenceScoreTriggersStore = {
  findMany: async () => {
    const orgId = getActiveOrgId();
    return store.marketingSequenceScoreTriggers.filter(
      (c) => c.orgId === orgId,
    );
  },
  findForSequence: async (sequenceId: string) => {
    const orgId = getActiveOrgId();
    return store.marketingSequenceScoreTriggers.filter(
      (m) => m.sequenceId === sequenceId && m.orgId === orgId,
    );
  },
  findOne: async (id: string) => {
    const orgId = getActiveOrgId();
    const m = store.marketingSequenceScoreTriggers.find((x) => x.id === id);
    if (m && m.orgId !== orgId) return null;
    return m || null;
  },
  insert: async (
    item: Omit<
      DBMarketingSequenceScoreTrigger,
      "id" | "createdAt" | "updatedAt"
    >,
  ) => {
    const _orgId = getActiveOrgId();
    assertTenantOwns(item);
    const newItem: DBMarketingSequenceScoreTrigger = {
      ...item,
      id: genId("sctr"),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    store.marketingSequenceScoreTriggers.push(newItem);
    return newItem;
  },
  delete: async (id: string) => {
    const _orgId = getActiveOrgId();
    const index = store.marketingSequenceScoreTriggers.findIndex(
      (c) => c.id === id,
    );
    if (index === -1) return false;
    assertTenantOwns(store.marketingSequenceScoreTriggers[index]);
    store.marketingSequenceScoreTriggers.splice(index, 1);
    return true;
  },
};
