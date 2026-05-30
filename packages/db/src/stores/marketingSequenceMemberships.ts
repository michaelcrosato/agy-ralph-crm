import { genId } from "../_ids";
import { assertTenantOwns } from "../_rls";
import type { DBMarketingSequenceMembership } from "../_store";
import { store } from "../_store";
import { getActiveOrgId } from "../_tenant";

export const marketingSequenceMembershipsStore = {
  findMany: async () => {
    const orgId = getActiveOrgId();
    return store.marketingSequenceMemberships.filter((c) => c.orgId === orgId);
  },
  findForSequence: async (sequenceId: string) => {
    const orgId = getActiveOrgId();
    return store.marketingSequenceMemberships.filter(
      (m) => m.sequenceId === sequenceId && m.orgId === orgId,
    );
  },
  findOne: async (id: string) => {
    const orgId = getActiveOrgId();
    const m = store.marketingSequenceMemberships.find((x) => x.id === id);
    if (m && m.orgId !== orgId) return null;
    return m || null;
  },
  insert: async (
    item: Omit<DBMarketingSequenceMembership, "id" | "createdAt" | "updatedAt">,
  ) => {
    const _orgId = getActiveOrgId();
    assertTenantOwns(item);
    const newItem: DBMarketingSequenceMembership = {
      ...item,
      engagementScore: item.engagementScore ?? 0,
      id: genId("memb"),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    store.marketingSequenceMemberships.push(newItem);
    return newItem;
  },
  update: async (
    id: string,
    updates: Partial<
      Omit<
        DBMarketingSequenceMembership,
        "id" | "orgId" | "createdAt" | "updatedAt"
      >
    >,
  ) => {
    const _orgId = getActiveOrgId();
    const index = store.marketingSequenceMemberships.findIndex(
      (c) => c.id === id,
    );
    if (index === -1) return null;
    assertTenantOwns(store.marketingSequenceMemberships[index]);
    store.marketingSequenceMemberships[index] = {
      ...store.marketingSequenceMemberships[index],
      ...updates,
      updatedAt: new Date(),
    };
    return store.marketingSequenceMemberships[index];
  },
  delete: async (id: string) => {
    const _orgId = getActiveOrgId();
    const index = store.marketingSequenceMemberships.findIndex(
      (c) => c.id === id,
    );
    if (index === -1) return false;
    assertTenantOwns(store.marketingSequenceMemberships[index]);
    store.marketingSequenceMemberships.splice(index, 1);
    return true;
  },
};
