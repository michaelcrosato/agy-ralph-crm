import { genId } from "../_ids";
import { assertTenantOwns } from "../_rls";
import type { DBMarketingSequenceStep } from "../_store";
import { store } from "../_store";
import { getActiveOrgId } from "../_tenant";

export const marketingSequenceStepsStore = {
  findMany: async () => {
    const orgId = getActiveOrgId();
    return store.marketingSequenceSteps.filter((c) => c.orgId === orgId);
  },
  findForSequence: async (sequenceId: string) => {
    const orgId = getActiveOrgId();
    return store.marketingSequenceSteps.filter(
      (s) => s.sequenceId === sequenceId && s.orgId === orgId,
    );
  },
  findOne: async (id: string) => {
    const orgId = getActiveOrgId();
    const m = store.marketingSequenceSteps.find((x) => x.id === id);
    if (m && m.orgId !== orgId) return null;
    return m || null;
  },
  insert: async (
    item: Omit<DBMarketingSequenceStep, "id" | "createdAt" | "updatedAt">,
  ) => {
    const _orgId = getActiveOrgId();
    assertTenantOwns(item);
    const newItem: DBMarketingSequenceStep = {
      ...item,
      id: genId("step"),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    store.marketingSequenceSteps.push(newItem);
    return newItem;
  },
  update: async (
    id: string,
    updates: Partial<
      Omit<DBMarketingSequenceStep, "id" | "orgId" | "createdAt" | "updatedAt">
    >,
  ) => {
    const _orgId = getActiveOrgId();
    const index = store.marketingSequenceSteps.findIndex((c) => c.id === id);
    if (index === -1) return null;
    assertTenantOwns(store.marketingSequenceSteps[index]);
    store.marketingSequenceSteps[index] = {
      ...store.marketingSequenceSteps[index],
      ...updates,
      updatedAt: new Date(),
    };
    return store.marketingSequenceSteps[index];
  },
  delete: async (id: string) => {
    const _orgId = getActiveOrgId();
    const index = store.marketingSequenceSteps.findIndex((c) => c.id === id);
    if (index === -1) return false;
    assertTenantOwns(store.marketingSequenceSteps[index]);
    store.marketingSequenceSteps.splice(index, 1);
    return true;
  },
};
