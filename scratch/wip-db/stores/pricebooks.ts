import { genId } from "../_ids";
import { assertTenantOwns } from "../_rls";
import type { DBPricebook } from "../_store";
import { store } from "../_store";
import { getActiveOrgId } from "../_tenant";

export const pricebooksStore = {
  findMany: async () => {
    const orgId = getActiveOrgId();
    return store.pricebooks.filter((pb) => pb.orgId === orgId);
  },
  findOne: async (id: string) => {
    const orgId = getActiveOrgId();
    const pb = store.pricebooks.find((x) => x.id === id);
    if (pb && pb.orgId !== orgId) return null;
    return pb || null;
  },
  insert: async (pb: Omit<DBPricebook, "id">) => {
    const _orgId = getActiveOrgId();
    assertTenantOwns(pb);
    const newPb: DBPricebook = {
      ...pb,
      id: genId("pricebook"),
    };
    store.pricebooks.push(newPb);
    return newPb;
  },
};
