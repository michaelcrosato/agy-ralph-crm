import { genId } from "../_ids";
import { assertTenantOwns } from "../_rls";
import type { DBMarketingSequenceLinkAction } from "../_store";
import { store } from "../_store";
import { getActiveOrgId } from "../_tenant";

export const marketingSequenceLinkActionsStore = {
  findMany: async () => {
    const orgId = getActiveOrgId();
    return store.marketingSequenceLinkActions.filter((c) => c.orgId === orgId);
  },
  findForStep: async (stepId: string) => {
    const orgId = getActiveOrgId();
    return store.marketingSequenceLinkActions.filter(
      (c) => c.stepId === stepId && c.orgId === orgId,
    );
  },
  findOne: async (id: string) => {
    const orgId = getActiveOrgId();
    const m = store.marketingSequenceLinkActions.find((x) => x.id === id);
    if (m && m.orgId !== orgId) return null;
    return m || null;
  },
  insert: async (
    item: Omit<DBMarketingSequenceLinkAction, "id" | "createdAt" | "updatedAt">,
  ) => {
    const _orgId = getActiveOrgId();
    assertTenantOwns(item);
    const newItem: DBMarketingSequenceLinkAction = {
      ...item,
      id: genId("act"),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    store.marketingSequenceLinkActions.push(newItem);
    return newItem;
  },
  delete: async (id: string) => {
    const _orgId = getActiveOrgId();
    const index = store.marketingSequenceLinkActions.findIndex(
      (c) => c.id === id,
    );
    if (index === -1) return false;
    assertTenantOwns(store.marketingSequenceLinkActions[index]);
    store.marketingSequenceLinkActions.splice(index, 1);
    return true;
  },
};
