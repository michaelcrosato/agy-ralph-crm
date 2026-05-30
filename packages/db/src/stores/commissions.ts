import { genId } from "../_ids";
import { assertTenantOwns } from "../_rls";
import type { DBCommission } from "../_store";
import { store } from "../_store";
import { getActiveOrgId } from "../_tenant";

export const commissionsStore = {
  findMany: async () => {
    const orgId = getActiveOrgId();
    return store.commissions.filter((c) => c.orgId === orgId);
  },
  findOne: async (id: string) => {
    const orgId = getActiveOrgId();
    const c = store.commissions.find((x) => x.id === id);
    if (c && c.orgId !== orgId) return null;
    return c || null;
  },
  insert: async (comm: Omit<DBCommission, "id" | "createdAt">) => {
    const _orgId = getActiveOrgId();
    assertTenantOwns(comm);
    const newComm: DBCommission = {
      ...comm,
      id: genId("commission"),
      createdAt: new Date(),
    };
    store.commissions.push(newComm);
    return newComm;
  },
  update: async (
    id: string,
    updates: Partial<Omit<DBCommission, "id" | "orgId" | "createdAt">>,
  ) => {
    const _orgId = getActiveOrgId();
    const index = store.commissions.findIndex((c) => c.id === id);
    if (index === -1) return null;
    assertTenantOwns(store.commissions[index]);
    store.commissions[index] = {
      ...store.commissions[index],
      ...updates,
    };
    return store.commissions[index];
  },
  delete: async (id: string) => {
    const _orgId = getActiveOrgId();
    const index = store.commissions.findIndex((c) => c.id === id);
    if (index === -1) return false;
    assertTenantOwns(store.commissions[index]);
    store.commissions.splice(index, 1);
    return true;
  },
  deleteManyForOpportunity: async (opportunityId: string) => {
    const orgId = getActiveOrgId();
    store.commissions = store.commissions.filter(
      (c) => !(c.opportunityId === opportunityId && c.orgId === orgId),
    );
    return true;
  },
};
