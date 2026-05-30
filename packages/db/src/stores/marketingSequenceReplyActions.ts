import { genId } from "../_ids";
import { assertTenantOwns } from "../_rls";
import type { DBMarketingSequenceReplyAction } from "../_store";
import { store } from "../_store";
import { getActiveOrgId } from "../_tenant";

export const marketingSequenceReplyActionsStore = {
  findMany: async () => {
    const orgId = getActiveOrgId();
    return store.marketingSequenceReplyActions.filter((c) => c.orgId === orgId);
  },
  findForStep: async (stepId: string) => {
    const orgId = getActiveOrgId();
    return store.marketingSequenceReplyActions.filter(
      (c) => c.stepId === stepId && c.orgId === orgId,
    );
  },
  findOne: async (id: string) => {
    const orgId = getActiveOrgId();
    const m = store.marketingSequenceReplyActions.find((x) => x.id === id);
    if (m && m.orgId !== orgId) return null;
    return m || null;
  },
  insert: async (
    item: Omit<
      DBMarketingSequenceReplyAction,
      "id" | "createdAt" | "updatedAt"
    >,
  ) => {
    const _orgId = getActiveOrgId();
    assertTenantOwns(item);
    const newItem: DBMarketingSequenceReplyAction = {
      ...item,
      id: genId("act"),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    store.marketingSequenceReplyActions.push(newItem);
    return newItem;
  },
  delete: async (id: string) => {
    const _orgId = getActiveOrgId();
    const index = store.marketingSequenceReplyActions.findIndex(
      (c) => c.id === id,
    );
    if (index === -1) return false;
    assertTenantOwns(store.marketingSequenceReplyActions[index]);
    store.marketingSequenceReplyActions.splice(index, 1);
    return true;
  },
};
