import { genId } from "../_ids";
import { assertTenantOwns } from "../_rls";
import type { DBOpportunitySplit } from "../_store";
import { store } from "../_store";
import { getActiveOrgId } from "../_tenant";

export const opportunitySplitsStore = {
  findMany: async () => {
    const orgId = getActiveOrgId();
    return store.opportunitySplits.filter((s) => s.orgId === orgId);
  },
  findForOpportunity: async (opportunityId: string) => {
    const orgId = getActiveOrgId();
    return store.opportunitySplits.filter(
      (s) => s.opportunityId === opportunityId && s.orgId === orgId,
    );
  },
  findOne: async (id: string) => {
    const orgId = getActiveOrgId();
    const s = store.opportunitySplits.find((x) => x.id === id);
    if (s && s.orgId !== orgId) return null;
    return s || null;
  },
  insert: async (split: Omit<DBOpportunitySplit, "id" | "createdAt">) => {
    const _orgId = getActiveOrgId();
    assertTenantOwns(split);
    const newSplit: DBOpportunitySplit = {
      ...split,
      id: genId("split"),
      createdAt: new Date(),
    };
    store.opportunitySplits.push(newSplit);
    return newSplit;
  },
  delete: async (id: string) => {
    const _orgId = getActiveOrgId();
    const index = store.opportunitySplits.findIndex((s) => s.id === id);
    if (index === -1) return false;
    assertTenantOwns(store.opportunitySplits[index]);
    store.opportunitySplits.splice(index, 1);
    return true;
  },
  deleteManyForOpportunity: async (opportunityId: string) => {
    const orgId = getActiveOrgId();
    store.opportunitySplits = store.opportunitySplits.filter(
      (s) => !(s.opportunityId === opportunityId && s.orgId === orgId),
    );
    return true;
  },
};
