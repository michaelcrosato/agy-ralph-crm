import { genId } from "../_ids";
import { assertTenantOwns } from "../_rls";
import type { DBMarketingSequence } from "../_store";
import { store } from "../_store";
import { getActiveOrgId } from "../_tenant";

export const marketingSequencesStore = {
  findMany: async () => {
    const orgId = getActiveOrgId();
    return store.marketingSequences.filter((c) => c.orgId === orgId);
  },
  findOne: async (id: string) => {
    const orgId = getActiveOrgId();
    const c = store.marketingSequences.find((x) => x.id === id);
    if (c && c.orgId !== orgId) return null;
    return c || null;
  },
  insert: async (
    item: Omit<DBMarketingSequence, "id" | "createdAt" | "updatedAt">,
  ) => {
    const _orgId = getActiveOrgId();
    assertTenantOwns(item);
    const newItem: DBMarketingSequence = {
      ...item,
      senderType: item.senderType ?? "system",
      senderUserId: item.senderUserId ?? null,
      id: genId("seq"),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    store.marketingSequences.push(newItem);
    return newItem;
  },
  update: async (
    id: string,
    updates: Partial<
      Omit<DBMarketingSequence, "id" | "orgId" | "createdAt" | "updatedAt">
    >,
  ) => {
    const _orgId = getActiveOrgId();
    const index = store.marketingSequences.findIndex((c) => c.id === id);
    if (index === -1) return null;
    assertTenantOwns(store.marketingSequences[index]);
    store.marketingSequences[index] = {
      ...store.marketingSequences[index],
      ...updates,
      updatedAt: new Date(),
    };
    return store.marketingSequences[index];
  },
  delete: async (id: string) => {
    const _orgId = getActiveOrgId();
    const index = store.marketingSequences.findIndex((c) => c.id === id);
    if (index === -1) return false;
    assertTenantOwns(store.marketingSequences[index]);
    store.marketingSequences.splice(index, 1);
    return true;
  },
};
