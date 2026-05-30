import { genId } from "../_ids";
import { assertTenantOwns } from "../_rls";
import type { DBPicklistDependency } from "../_store";
import { store } from "../_store";
import { getActiveOrgId } from "../_tenant";

export const picklistDependenciesStore = {
  findMany: async () => {
    const orgId = getActiveOrgId();
    return store.picklistDependencies.filter((d) => d.orgId === orgId);
  },
  findOne: async (id: string) => {
    const orgId = getActiveOrgId();
    const d = store.picklistDependencies.find((x) => x.id === id);
    if (d && d.orgId !== orgId) return null;
    return d || null;
  },
  insert: async (
    d: Omit<DBPicklistDependency, "id" | "createdAt" | "updatedAt">,
  ) => {
    const _orgId = getActiveOrgId();
    assertTenantOwns(d);
    const newDep: DBPicklistDependency = {
      ...d,
      id: genId("pldep"),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    store.picklistDependencies.push(newDep);
    return newDep;
  },
  update: async (
    id: string,
    updates: Partial<
      Omit<DBPicklistDependency, "id" | "orgId" | "createdAt" | "updatedAt">
    >,
  ) => {
    const _orgId = getActiveOrgId();
    const index = store.picklistDependencies.findIndex((x) => x.id === id);
    if (index === -1) return null;
    assertTenantOwns(store.picklistDependencies[index]);
    store.picklistDependencies[index] = {
      ...store.picklistDependencies[index],
      ...updates,
      updatedAt: new Date(),
    };
    return store.picklistDependencies[index];
  },
  delete: async (id: string) => {
    const _orgId = getActiveOrgId();
    const index = store.picklistDependencies.findIndex((x) => x.id === id);
    if (index === -1) return false;
    assertTenantOwns(store.picklistDependencies[index]);
    store.picklistDependencies.splice(index, 1);
    return true;
  },
};
