import { genId } from "../_ids";
import { assertTenantOwns } from "../_rls";
import type { DBMarketingSequenceStepBranch } from "../_store";
import { store } from "../_store";
import { getActiveOrgId } from "../_tenant";

export const marketingSequenceStepBranchesStore = {
  findMany: async () => {
    const orgId = getActiveOrgId();
    return store.marketingSequenceStepBranches.filter((c) => c.orgId === orgId);
  },
  findForStep: async (stepId: string) => {
    const orgId = getActiveOrgId();
    return (
      store.marketingSequenceStepBranches.find(
        (m) => m.stepId === stepId && m.orgId === orgId,
      ) || null
    );
  },
  findOne: async (id: string) => {
    const orgId = getActiveOrgId();
    const m = store.marketingSequenceStepBranches.find((x) => x.id === id);
    if (m && m.orgId !== orgId) return null;
    return m || null;
  },
  insert: async (
    item: Omit<DBMarketingSequenceStepBranch, "id" | "createdAt" | "updatedAt">,
  ) => {
    const _orgId = getActiveOrgId();
    assertTenantOwns(item);
    const newItem: DBMarketingSequenceStepBranch = {
      ...item,
      id: genId("branch"),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    store.marketingSequenceStepBranches.push(newItem);
    return newItem;
  },
  update: async (
    id: string,
    updates: Partial<
      Omit<
        DBMarketingSequenceStepBranch,
        "id" | "orgId" | "createdAt" | "updatedAt"
      >
    >,
  ) => {
    const _orgId = getActiveOrgId();
    const index = store.marketingSequenceStepBranches.findIndex(
      (c) => c.id === id,
    );
    if (index === -1) return null;
    assertTenantOwns(store.marketingSequenceStepBranches[index]);
    store.marketingSequenceStepBranches[index] = {
      ...store.marketingSequenceStepBranches[index],
      ...updates,
      updatedAt: new Date(),
    };
    return store.marketingSequenceStepBranches[index];
  },
  delete: async (id: string) => {
    const _orgId = getActiveOrgId();
    const index = store.marketingSequenceStepBranches.findIndex(
      (c) => c.id === id,
    );
    if (index === -1) return false;
    assertTenantOwns(store.marketingSequenceStepBranches[index]);
    store.marketingSequenceStepBranches.splice(index, 1);
    return true;
  },
};
