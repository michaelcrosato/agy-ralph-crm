import { genId } from "../_ids";
import { assertTenantOwns } from "../_rls";
import type { DBOpportunityStageGate } from "../_store";
import { store } from "../_store";
import { getActiveOrgId } from "../_tenant";

export const opportunityStageGatesStore = {
  findMany: async () => {
    const orgId = getActiveOrgId();
    return store.opportunityStageGates.filter((g) => g.orgId === orgId);
  },
  findOne: async (id: string) => {
    const orgId = getActiveOrgId();
    const g = store.opportunityStageGates.find((x) => x.id === id);
    if (g && g.orgId !== orgId) {
      return null;
    }
    return g || null;
  },
  insert: async (
    g: Omit<DBOpportunityStageGate, "id" | "createdAt" | "updatedAt">,
  ) => {
    const _orgId = getActiveOrgId();
    assertTenantOwns(g);
    const newGate: DBOpportunityStageGate = {
      ...g,
      id: genId("gate"),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    store.opportunityStageGates.push(newGate);
    return newGate;
  },
  update: async (
    id: string,
    updates: Partial<
      Omit<DBOpportunityStageGate, "id" | "orgId" | "createdAt" | "updatedAt">
    >,
  ) => {
    const _orgId = getActiveOrgId();
    const index = store.opportunityStageGates.findIndex((x) => x.id === id);
    if (index === -1) return null;
    assertTenantOwns(store.opportunityStageGates[index]);
    store.opportunityStageGates[index] = {
      ...store.opportunityStageGates[index],
      ...updates,
      updatedAt: new Date(),
    };
    return store.opportunityStageGates[index];
  },
  delete: async (id: string) => {
    const _orgId = getActiveOrgId();
    const index = store.opportunityStageGates.findIndex((x) => x.id === id);
    if (index === -1) return false;
    assertTenantOwns(store.opportunityStageGates[index]);
    store.opportunityStageGates.splice(index, 1);
    return true;
  },
};
