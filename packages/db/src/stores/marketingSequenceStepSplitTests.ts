import { genId } from "../_ids";
import { assertTenantOwns } from "../_rls";
import type { DBMarketingSequenceStepSplitTest } from "../_store";
import { store } from "../_store";
import { getActiveOrgId } from "../_tenant";

export const marketingSequenceStepSplitTestsStore = {
  findMany: async () => {
    const orgId = getActiveOrgId();
    return store.marketingSequenceStepSplitTests.filter(
      (c) => c.orgId === orgId,
    );
  },
  findForStep: async (stepId: string) => {
    const orgId = getActiveOrgId();
    return (
      store.marketingSequenceStepSplitTests.find(
        (m) => m.stepId === stepId && m.orgId === orgId,
      ) || null
    );
  },
  findOne: async (id: string) => {
    const orgId = getActiveOrgId();
    const m = store.marketingSequenceStepSplitTests.find((x) => x.id === id);
    if (m && m.orgId !== orgId) return null;
    return m || null;
  },
  insert: async (
    item: Omit<
      DBMarketingSequenceStepSplitTest,
      "id" | "createdAt" | "updatedAt"
    >,
  ) => {
    const _orgId = getActiveOrgId();
    assertTenantOwns(item);
    const newItem: DBMarketingSequenceStepSplitTest = {
      autoPromoteWinner: 0,
      minSendsToEvaluate: 10,
      evaluationMetric: "open_rate",
      ...item,
      id: genId("split"),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    store.marketingSequenceStepSplitTests.push(newItem);
    return newItem;
  },
  update: async (
    id: string,
    updates: Partial<
      Omit<
        DBMarketingSequenceStepSplitTest,
        "id" | "orgId" | "createdAt" | "updatedAt"
      >
    >,
  ) => {
    const _orgId = getActiveOrgId();
    const index = store.marketingSequenceStepSplitTests.findIndex(
      (c) => c.id === id,
    );
    if (index === -1) return null;
    assertTenantOwns(store.marketingSequenceStepSplitTests[index]);
    store.marketingSequenceStepSplitTests[index] = {
      ...store.marketingSequenceStepSplitTests[index],
      ...updates,
      updatedAt: new Date(),
    };
    return store.marketingSequenceStepSplitTests[index];
  },
  delete: async (id: string) => {
    const _orgId = getActiveOrgId();
    const index = store.marketingSequenceStepSplitTests.findIndex(
      (c) => c.id === id,
    );
    if (index === -1) return false;
    assertTenantOwns(store.marketingSequenceStepSplitTests[index]);
    store.marketingSequenceStepSplitTests.splice(index, 1);
    return true;
  },
};
