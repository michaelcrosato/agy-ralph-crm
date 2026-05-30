import { genId } from "../_ids";
import { assertTenantOwns } from "../_rls";
import type { DBProduct } from "../_store";
import { store } from "../_store";
import { getActiveOrgId } from "../_tenant";

export const productsStore = {
  findMany: async () => {
    const orgId = getActiveOrgId();
    return store.products.filter((p) => p.orgId === orgId);
  },
  findOne: async (id: string) => {
    const orgId = getActiveOrgId();
    const p = store.products.find((x) => x.id === id);
    if (p && p.orgId !== orgId) return null;
    return p || null;
  },
  insert: async (p: Omit<DBProduct, "id">) => {
    const _orgId = getActiveOrgId();
    assertTenantOwns(p);
    const newProduct: DBProduct = {
      ...p,
      id: genId("product"),
    };
    store.products.push(newProduct);
    return newProduct;
  },
};
