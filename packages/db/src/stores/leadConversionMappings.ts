import { genId } from "../_ids";
import { assertTenantOwns } from "../_rls";
import type { DBLeadConversionMapping } from "../_store";
import { store } from "../_store";
import { getActiveOrgId } from "../_tenant";

export const leadConversionMappingsStore = {
  findMany: async () => {
    const orgId = getActiveOrgId();
    return store.leadConversionMappings.filter((m) => m.orgId === orgId);
  },
  findOne: async (id: string) => {
    const orgId = getActiveOrgId();
    const mapping = store.leadConversionMappings.find((m) => m.id === id);
    if (mapping && mapping.orgId !== orgId) {
      return null;
    }
    return mapping || null;
  },
  insert: async (
    mapping: Omit<DBLeadConversionMapping, "id" | "createdAt">,
  ) => {
    const _orgId = getActiveOrgId();
    assertTenantOwns(mapping);
    const newMapping: DBLeadConversionMapping = {
      ...mapping,
      id: genId("mapping"),
      createdAt: new Date(),
    };
    store.leadConversionMappings.push(newMapping);
    return newMapping;
  },
  delete: async (id: string) => {
    const _orgId = getActiveOrgId();
    const index = store.leadConversionMappings.findIndex((m) => m.id === id);
    if (index === -1) return false;
    assertTenantOwns(store.leadConversionMappings[index]);
    store.leadConversionMappings.splice(index, 1);
    return true;
  },
};
