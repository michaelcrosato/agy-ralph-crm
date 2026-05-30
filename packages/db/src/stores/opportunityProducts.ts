import { genId } from "../_ids";
import { assertTenantOwns } from "../_rls";
import type { DBOpportunityProduct } from "../_store";
import { store } from "../_store";
import { getActiveOrgId } from "../_tenant";

export const opportunityProductsStore = {
  findMany: async () => {
    const orgId = getActiveOrgId();
    return store.opportunityProducts.filter((op) => op.orgId === orgId);
  },
  findOne: async (id: string) => {
    const orgId = getActiveOrgId();
    const op = store.opportunityProducts.find((x) => x.id === id);
    if (op && op.orgId !== orgId) return null;
    return op || null;
  },
  insert: async (op: Omit<DBOpportunityProduct, "id">) => {
    const _orgId = getActiveOrgId();
    assertTenantOwns(op);
    const newOp: DBOpportunityProduct = {
      ...op,
      id: genId("line"),
    };
    store.opportunityProducts.push(newOp);
    return newOp;
  },
  update: async (
    id: string,
    updates: Partial<
      Omit<
        DBOpportunityProduct,
        "id" | "orgId" | "opportunityId" | "pricebookEntryId"
      >
    >,
  ) => {
    const _orgId = getActiveOrgId();
    const index = store.opportunityProducts.findIndex((x) => x.id === id);
    if (index === -1) return null;
    assertTenantOwns(store.opportunityProducts[index]);
    store.opportunityProducts[index] = {
      ...store.opportunityProducts[index],
      ...updates,
    };
    return store.opportunityProducts[index];
  },
  delete: async (id: string) => {
    const _orgId = getActiveOrgId();
    const index = store.opportunityProducts.findIndex((x) => x.id === id);
    if (index === -1) return false;
    assertTenantOwns(store.opportunityProducts[index]);
    store.opportunityProducts.splice(index, 1);
    return true;
  },
};
