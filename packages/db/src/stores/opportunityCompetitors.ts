import { genId } from "../_ids";
import { assertTenantOwns } from "../_rls";
import type { DBOpportunityCompetitor } from "../_store";
import { store } from "../_store";
import { getActiveOrgId } from "../_tenant";

export const opportunityCompetitorsStore = {
  findMany: async () => {
    const orgId = getActiveOrgId();
    return store.opportunityCompetitors.filter((c) => c.orgId === orgId);
  },
  findOne: async (id: string) => {
    const orgId = getActiveOrgId();
    const comp = store.opportunityCompetitors.find((c) => c.id === id);
    if (comp && comp.orgId !== orgId) {
      return null;
    }
    return comp || null;
  },
  insert: async (comp: Omit<DBOpportunityCompetitor, "id" | "createdAt">) => {
    const _orgId = getActiveOrgId();
    assertTenantOwns(comp);
    const newComp: DBOpportunityCompetitor = {
      ...comp,
      id: genId("opcomp"),
      createdAt: new Date(),
    };
    store.opportunityCompetitors.push(newComp);
    return newComp;
  },
  update: async (
    id: string,
    updates: Partial<
      Omit<DBOpportunityCompetitor, "id" | "orgId" | "createdAt">
    >,
  ) => {
    const _orgId = getActiveOrgId();
    const index = store.opportunityCompetitors.findIndex((c) => c.id === id);
    if (index === -1) {
      return null;
    }
    assertTenantOwns(store.opportunityCompetitors[index]);
    store.opportunityCompetitors[index] = {
      ...store.opportunityCompetitors[index],
      ...updates,
    };
    return store.opportunityCompetitors[index];
  },
  delete: async (id: string) => {
    const _orgId = getActiveOrgId();
    const index = store.opportunityCompetitors.findIndex((c) => c.id === id);
    if (index === -1) {
      return false;
    }
    assertTenantOwns(store.opportunityCompetitors[index]);
    store.opportunityCompetitors.splice(index, 1);
    return true;
  },
};
