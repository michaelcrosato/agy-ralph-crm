import { genId } from "../_ids";
import { assertTenantOwns } from "../_rls";
import type { DBCustomEntityType } from "../_store";
import { store } from "../_store";
import { getActiveOrgId } from "../_tenant";

export const customEntityTypesStore = {
  findMany: async () => {
    const orgId = getActiveOrgId();
    return store.customEntityTypes.filter((type) => type.orgId === orgId);
  },
  findOne: async (id: string) => {
    const orgId = getActiveOrgId();
    const type = store.customEntityTypes.find((t) => t.id === id);
    if (type && type.orgId !== orgId) {
      return null;
    }
    return type || null;
  },
  insert: async (type: Omit<DBCustomEntityType, "id"> & { id?: string }) => {
    assertTenantOwns(type);
    const newType: DBCustomEntityType = {
      ...type,
      id: type.id || genId("cetype"),
    };
    store.customEntityTypes.push(newType);
    return newType;
  },
  update: async (
    id: string,
    updates: Partial<Omit<DBCustomEntityType, "id" | "orgId">>,
  ) => {
    const index = store.customEntityTypes.findIndex((t) => t.id === id);
    if (index === -1) return null;
    assertTenantOwns(store.customEntityTypes[index]);
    store.customEntityTypes[index] = {
      ...store.customEntityTypes[index],
      ...updates,
    };
    return store.customEntityTypes[index];
  },
  delete: async (id: string) => {
    const index = store.customEntityTypes.findIndex((t) => t.id === id);
    if (index === -1) return false;
    assertTenantOwns(store.customEntityTypes[index]);
    store.customEntityTypes.splice(index, 1);
    return true;
  },
};
