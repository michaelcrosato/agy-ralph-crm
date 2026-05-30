import { genId } from "../_ids";
import { assertTenantOwns } from "../_rls";
import type { DBMarketingSequenceCap } from "../_store";
import { store } from "../_store";
import { getActiveOrgId } from "../_tenant";

export const marketingSequenceCapsStore = {
  findMany: async () => {
    const orgId = getActiveOrgId();
    return store.marketingSequenceCaps.filter((c) => c.orgId === orgId);
  },
  findOne: async (id: string) => {
    const orgId = getActiveOrgId();
    const m = store.marketingSequenceCaps.find((x) => x.id === id);
    if (m && m.orgId !== orgId) return null;
    return m || null;
  },
  insert: async (
    item: Omit<DBMarketingSequenceCap, "id" | "createdAt" | "updatedAt">,
  ) => {
    const _orgId = getActiveOrgId();
    assertTenantOwns(item);
    const newItem: DBMarketingSequenceCap = {
      ...item,
      id: genId("cap"),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    store.marketingSequenceCaps.push(newItem);
    return newItem;
  },
  update: async (
    id: string,
    updates: Partial<
      Omit<DBMarketingSequenceCap, "id" | "orgId" | "createdAt" | "updatedAt">
    >,
  ) => {
    const _orgId = getActiveOrgId();
    const index = store.marketingSequenceCaps.findIndex((x) => x.id === id);
    if (index === -1) return null;
    assertTenantOwns(store.marketingSequenceCaps[index]);
    store.marketingSequenceCaps[index] = {
      ...store.marketingSequenceCaps[index],
      ...updates,
      updatedAt: new Date(),
    };
    return store.marketingSequenceCaps[index];
  },
  delete: async (id: string) => {
    const _orgId = getActiveOrgId();
    const index = store.marketingSequenceCaps.findIndex((c) => c.id === id);
    if (index === -1) return false;
    assertTenantOwns(store.marketingSequenceCaps[index]);
    store.marketingSequenceCaps.splice(index, 1);
    return true;
  },
};
