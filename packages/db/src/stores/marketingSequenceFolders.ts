import { genId } from "../_ids";
import { assertTenantOwns } from "../_rls";
import type { DBMarketingSequenceFolder } from "../_store";
import { store } from "../_store";
import { getActiveOrgId } from "../_tenant";

export const marketingSequenceFoldersStore = {
  findMany: async () => {
    const orgId = getActiveOrgId();
    return store.marketingSequenceFolders.filter((c) => c.orgId === orgId);
  },
  findOne: async (id: string) => {
    const orgId = getActiveOrgId();
    const folder = store.marketingSequenceFolders.find((x) => x.id === id);
    if (folder && folder.orgId !== orgId) return null;
    return folder || null;
  },
  insert: async (item: Omit<DBMarketingSequenceFolder, "id" | "createdAt">) => {
    const _orgId = getActiveOrgId();
    assertTenantOwns(item);
    const newItem: DBMarketingSequenceFolder = {
      ...item,
      id: genId("msfo"),
      createdAt: new Date(),
    };
    store.marketingSequenceFolders.push(newItem);
    return newItem;
  },
  update: async (
    id: string,
    updates: Partial<Omit<DBMarketingSequenceFolder, "id" | "orgId">>,
  ) => {
    const _orgId = getActiveOrgId();
    const index = store.marketingSequenceFolders.findIndex((c) => c.id === id);
    if (index === -1) return null;
    assertTenantOwns(store.marketingSequenceFolders[index]);
    store.marketingSequenceFolders[index] = {
      ...store.marketingSequenceFolders[index],
      ...updates,
    };
    return store.marketingSequenceFolders[index];
  },
  delete: async (id: string) => {
    const _orgId = getActiveOrgId();
    const index = store.marketingSequenceFolders.findIndex((c) => c.id === id);
    if (index === -1) return false;
    assertTenantOwns(store.marketingSequenceFolders[index]);
    store.marketingSequenceFolders.splice(index, 1);
    return true;
  },
};
