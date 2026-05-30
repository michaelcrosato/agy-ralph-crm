import { genId } from "../_ids";
import { assertTenantOwns } from "../_rls";
import type { DBQuota } from "../_store";
import { store } from "../_store";
import { getActiveOrgId } from "../_tenant";

export const quotasStore = {
  findMany: async () => {
    const orgId = getActiveOrgId();
    return store.quotas.filter((q) => q.orgId === orgId);
  },
  insert: async (quota: Omit<DBQuota, "id">) => {
    const _orgId = getActiveOrgId();
    assertTenantOwns(quota);
    const newQuota: DBQuota = {
      ...quota,
      id: genId("quota"),
    };
    store.quotas.push(newQuota);
    return newQuota;
  },
};
