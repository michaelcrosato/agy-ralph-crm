import { genId } from "../_ids";
import { assertTenantOwns } from "../_rls";
import type { DBOpportunity } from "../_store";
import { store } from "../_store";
import { getActiveOrgId } from "../_tenant";

export const opportunitiesStore = {
  findMany: async () => {
    const orgId = getActiveOrgId();
    return store.opportunities.filter((o) => o.orgId === orgId);
  },
  findOne: async (id: string) => {
    const orgId = getActiveOrgId();
    const o = store.opportunities.find((x) => x.id === id);
    if (o && o.orgId !== orgId) {
      return null;
    }
    return o || null;
  },
  insert: async (o: Omit<DBOpportunity, "id">) => {
    const _orgId = getActiveOrgId();
    assertTenantOwns(o);
    const newOpp: DBOpportunity = {
      ...o,
      currencyCode: o.currencyCode || "USD",
      amountCorporate: o.amountCorporate || null,
      id: genId("opp"),
    };
    store.opportunities.push(newOpp);
    return newOpp;
  },
  update: async (
    id: string,
    updates: Partial<Omit<DBOpportunity, "id" | "orgId">>,
  ) => {
    const _orgId = getActiveOrgId();
    const index = store.opportunities.findIndex((o) => o.id === id);
    if (index === -1) return null;
    assertTenantOwns(store.opportunities[index]);
    store.opportunities[index] = {
      ...store.opportunities[index],
      ...updates,
    };
    return store.opportunities[index];
  },
};
