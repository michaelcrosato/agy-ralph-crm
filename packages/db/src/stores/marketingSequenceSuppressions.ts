import { genId } from "../_ids";
import { assertTenantOwns } from "../_rls";
import type { DBMarketingSequenceSuppression } from "../_store";
import { store } from "../_store";
import { getActiveOrgId } from "../_tenant";

export const marketingSequenceSuppressionsStore = {
  findMany: async () => {
    const orgId = getActiveOrgId();
    return store.marketingSequenceSuppressions.filter((c) => c.orgId === orgId);
  },
  findForOrg: async (orgId: string) => {
    const activeOrgId = getActiveOrgId();
    if (orgId !== activeOrgId) {
      throw new Error("RLS Isolation Violation: Tenant mismatch.");
    }
    return store.marketingSequenceSuppressions.filter((c) => c.orgId === orgId);
  },
  findOne: async (id: string) => {
    const orgId = getActiveOrgId();
    const m = store.marketingSequenceSuppressions.find((x) => x.id === id);
    if (m && m.orgId !== orgId) return null;
    return m || null;
  },
  insert: async (
    item: Omit<DBMarketingSequenceSuppression, "id" | "createdAt">,
  ) => {
    const _orgId = getActiveOrgId();
    assertTenantOwns(item);
    const newItem: DBMarketingSequenceSuppression = {
      ...item,
      id: genId("supp"),
      createdAt: new Date(),
    };
    store.marketingSequenceSuppressions.push(newItem);
    return newItem;
  },
  delete: async (id: string) => {
    const _orgId = getActiveOrgId();
    const index = store.marketingSequenceSuppressions.findIndex(
      (c) => c.id === id,
    );
    if (index === -1) return false;
    assertTenantOwns(store.marketingSequenceSuppressions[index]);
    store.marketingSequenceSuppressions.splice(index, 1);
    return true;
  },
};
