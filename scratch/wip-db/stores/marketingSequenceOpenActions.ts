import { genId } from "../_ids";
import { assertTenantOwns } from "../_rls";
import type { DBMarketingSequenceOpenAction } from "../_store";
import { store } from "../_store";
import { getActiveOrgId } from "../_tenant";

export const marketingSequenceOpenActionsStore = {
  findMany: async () => {
    const orgId = getActiveOrgId();
    return store.marketingSequenceOpenActions.filter((c) => c.orgId === orgId);
  },
  findForStep: async (stepId: string) => {
    const orgId = getActiveOrgId();
    return store.marketingSequenceOpenActions.filter(
      (c) => c.stepId === stepId && c.orgId === orgId,
    );
  },
  findOne: async (id: string) => {
    const orgId = getActiveOrgId();
    const m = store.marketingSequenceOpenActions.find((x) => x.id === id);
    if (m && m.orgId !== orgId) return null;
    return m || null;
  },
  insert: async (
    item: Omit<DBMarketingSequenceOpenAction, "id" | "createdAt" | "updatedAt">,
  ) => {
    const _orgId = getActiveOrgId();
    assertTenantOwns(item);
    const newItem: DBMarketingSequenceOpenAction = {
      ...item,
      id: genId("act"),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    store.marketingSequenceOpenActions.push(newItem);
    return newItem;
  },
  delete: async (id: string) => {
    const _orgId = getActiveOrgId();
    const index = store.marketingSequenceOpenActions.findIndex(
      (c) => c.id === id,
    );
    if (index === -1) return false;
    assertTenantOwns(store.marketingSequenceOpenActions[index]);
    store.marketingSequenceOpenActions.splice(index, 1);
    return true;
  },
};
