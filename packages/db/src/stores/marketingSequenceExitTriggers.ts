import { genId } from "../_ids";
import { assertTenantOwns } from "../_rls";
import type { DBMarketingSequenceExitTrigger } from "../_store";
import { store } from "../_store";
import { getActiveOrgId } from "../_tenant";

export const marketingSequenceExitTriggersStore = {
  findMany: async () => {
    const orgId = getActiveOrgId();
    return store.marketingSequenceExitTriggers.filter((c) => c.orgId === orgId);
  },
  findForSequence: async (sequenceId: string) => {
    const orgId = getActiveOrgId();
    return store.marketingSequenceExitTriggers.filter(
      (m) => m.sequenceId === sequenceId && m.orgId === orgId,
    );
  },
  findOne: async (id: string) => {
    const orgId = getActiveOrgId();
    const m = store.marketingSequenceExitTriggers.find((x) => x.id === id);
    if (m && m.orgId !== orgId) return null;
    return m || null;
  },
  insert: async (
    item: Omit<
      DBMarketingSequenceExitTrigger,
      "id" | "createdAt" | "updatedAt"
    >,
  ) => {
    const _orgId = getActiveOrgId();
    assertTenantOwns(item);
    const newItem: DBMarketingSequenceExitTrigger = {
      ...item,
      id: genId("trig"),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    store.marketingSequenceExitTriggers.push(newItem);
    return newItem;
  },
  delete: async (id: string) => {
    const _orgId = getActiveOrgId();
    const index = store.marketingSequenceExitTriggers.findIndex(
      (c) => c.id === id,
    );
    if (index === -1) return false;
    assertTenantOwns(store.marketingSequenceExitTriggers[index]);
    store.marketingSequenceExitTriggers.splice(index, 1);
    return true;
  },
};
