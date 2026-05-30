import { genId } from "../_ids";
import { assertTenantOwns } from "../_rls";
import type { DBMarketingSequenceGlobalVariable } from "../_store";
import { store } from "../_store";
import { getActiveOrgId } from "../_tenant";

export const marketingSequenceGlobalVariablesStore = {
  findMany: async () => {
    const orgId = getActiveOrgId();
    return store.marketingSequenceGlobalVariables.filter(
      (c) => c.orgId === orgId,
    );
  },
  findOne: async (id: string) => {
    const orgId = getActiveOrgId();
    const m = store.marketingSequenceGlobalVariables.find((x) => x.id === id);
    if (m && m.orgId !== orgId) return null;
    return m || null;
  },
  insert: async (
    item: Omit<
      DBMarketingSequenceGlobalVariable,
      "id" | "createdAt" | "updatedAt"
    >,
  ) => {
    const orgId = getActiveOrgId();
    assertTenantOwns(item);
    const existingIndex = store.marketingSequenceGlobalVariables.findIndex(
      (c) => c.orgId === orgId && c.key === item.key,
    );
    if (existingIndex !== -1) {
      const updated = {
        ...store.marketingSequenceGlobalVariables[existingIndex],
        value: item.value,
        updatedAt: new Date(),
      };
      store.marketingSequenceGlobalVariables[existingIndex] = updated;
      return updated;
    }
    const newItem: DBMarketingSequenceGlobalVariable = {
      ...item,
      id: genId("msvg"),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    store.marketingSequenceGlobalVariables.push(newItem);
    return newItem;
  },
  delete: async (id: string) => {
    const _orgId = getActiveOrgId();
    const index = store.marketingSequenceGlobalVariables.findIndex(
      (c) => c.id === id,
    );
    if (index === -1) return false;
    assertTenantOwns(store.marketingSequenceGlobalVariables[index]);
    store.marketingSequenceGlobalVariables.splice(index, 1);
    return true;
  },
};
