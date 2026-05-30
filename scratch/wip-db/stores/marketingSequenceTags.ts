import { genId } from "../_ids";
import { assertTenantOwns } from "../_rls";
import type { DBMarketingSequenceTag } from "../_store";
import { store } from "../_store";
import { getActiveOrgId } from "../_tenant";

export const marketingSequenceTagsStore = {
  findMany: async () => {
    const orgId = getActiveOrgId();
    return store.marketingSequenceTags.filter((c) => c.orgId === orgId);
  },
  findOne: async (id: string) => {
    const orgId = getActiveOrgId();
    const tag = store.marketingSequenceTags.find((x) => x.id === id);
    if (tag && tag.orgId !== orgId) return null;
    return tag || null;
  },
  insert: async (item: Omit<DBMarketingSequenceTag, "id" | "createdAt">) => {
    const _orgId = getActiveOrgId();
    assertTenantOwns(item);
    const newItem: DBMarketingSequenceTag = {
      ...item,
      id: genId("msta"),
      createdAt: new Date(),
    };
    store.marketingSequenceTags.push(newItem);
    return newItem;
  },
  delete: async (id: string) => {
    const _orgId = getActiveOrgId();
    const index = store.marketingSequenceTags.findIndex((c) => c.id === id);
    if (index === -1) return false;
    assertTenantOwns(store.marketingSequenceTags[index]);
    store.marketingSequenceTags.splice(index, 1);
    return true;
  },
};
