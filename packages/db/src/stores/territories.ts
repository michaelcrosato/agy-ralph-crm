import { genId } from "../_ids";
import { assertTenantOwns } from "../_rls";
import type { DBTerritory } from "../_store";
import { store } from "../_store";
import { getActiveOrgId } from "../_tenant";

export const territoriesStore = {
  findMany: async () => {
    const orgId = getActiveOrgId();
    return store.territories.filter((t) => t.orgId === orgId);
  },
  findOne: async (id: string) => {
    const orgId = getActiveOrgId();
    const t = store.territories.find((x) => x.id === id);
    if (t && t.orgId !== orgId) return null;
    return t || null;
  },
  insert: async (territory: Omit<DBTerritory, "id" | "createdAt">) => {
    const _orgId = getActiveOrgId();
    assertTenantOwns(territory);
    const newTerritory: DBTerritory = {
      ...territory,
      id: genId("territory"),
      createdAt: new Date(),
    };
    store.territories.push(newTerritory);
    return newTerritory;
  },
  update: async (
    id: string,
    updates: Partial<Omit<DBTerritory, "id" | "orgId" | "createdAt">>,
  ) => {
    const _orgId = getActiveOrgId();
    const index = store.territories.findIndex((t) => t.id === id);
    if (index === -1) return null;
    assertTenantOwns(store.territories[index]);
    store.territories[index] = {
      ...store.territories[index],
      ...updates,
    };
    return store.territories[index];
  },
};
