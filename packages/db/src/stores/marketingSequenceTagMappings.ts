import { genId } from "../_ids";
import { assertTenantOwns } from "../_rls";
import type { DBMarketingSequenceTagMapping } from "../_store";
import { store } from "../_store";
import { getActiveOrgId } from "../_tenant";

export const marketingSequenceTagMappingsStore = {
  findMany: async () => {
    const orgId = getActiveOrgId();
    return store.marketingSequenceTagMappings.filter((c) => c.orgId === orgId);
  },
  findForSequence: async (sequenceId: string) => {
    const orgId = getActiveOrgId();
    return store.marketingSequenceTagMappings.filter(
      (c) => c.sequenceId === sequenceId && c.orgId === orgId,
    );
  },
  findOne: async (id: string) => {
    const orgId = getActiveOrgId();
    const mapping = store.marketingSequenceTagMappings.find((x) => x.id === id);
    if (mapping && mapping.orgId !== orgId) return null;
    return mapping || null;
  },
  insert: async (item: Omit<DBMarketingSequenceTagMapping, "id">) => {
    const _orgId = getActiveOrgId();
    assertTenantOwns(item);
    const newItem: DBMarketingSequenceTagMapping = {
      ...item,
      id: genId("mstm"),
    };
    store.marketingSequenceTagMappings.push(newItem);
    return newItem;
  },
  delete: async (id: string) => {
    const _orgId = getActiveOrgId();
    const index = store.marketingSequenceTagMappings.findIndex(
      (c) => c.id === id,
    );
    if (index === -1) return false;
    assertTenantOwns(store.marketingSequenceTagMappings[index]);
    store.marketingSequenceTagMappings.splice(index, 1);
    return true;
  },
  deleteForSequenceAndTag: async (sequenceId: string, tagId: string) => {
    const orgId = getActiveOrgId();
    const index = store.marketingSequenceTagMappings.findIndex(
      (c) =>
        c.sequenceId === sequenceId && c.tagId === tagId && c.orgId === orgId,
    );
    if (index === -1) return false;
    store.marketingSequenceTagMappings.splice(index, 1);
    return true;
  },
};
