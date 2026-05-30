import { genId } from "../_ids";
import { assertTenantOwns } from "../_rls";
import type { DBContract } from "../_store";
import { store } from "../_store";
import { getActiveOrgId } from "../_tenant";

export const contractsStore = {
  findMany: async () => {
    const orgId = getActiveOrgId();
    return store.contracts.filter((c) => c.orgId === orgId);
  },
  findForAccount: async (accountId: string) => {
    const orgId = getActiveOrgId();
    return store.contracts.filter(
      (c) => c.accountId === accountId && c.orgId === orgId,
    );
  },
  findOne: async (id: string) => {
    const orgId = getActiveOrgId();
    const c = store.contracts.find((x) => x.id === id);
    if (c && c.orgId !== orgId) return null;
    return c || null;
  },
  insert: async (contract: Omit<DBContract, "id" | "createdAt">) => {
    const _orgId = getActiveOrgId();
    assertTenantOwns(contract);
    const newContract: DBContract = {
      ...contract,
      id: genId("contract"),
      createdAt: new Date(),
    };
    store.contracts.push(newContract);
    return newContract;
  },
  update: async (
    id: string,
    updates: Partial<Omit<DBContract, "id" | "orgId" | "createdAt">>,
  ) => {
    const _orgId = getActiveOrgId();
    const index = store.contracts.findIndex((c) => c.id === id);
    if (index === -1) return null;
    assertTenantOwns(store.contracts[index]);
    store.contracts[index] = {
      ...store.contracts[index],
      ...updates,
    };
    return store.contracts[index];
  },
  delete: async (id: string) => {
    const _orgId = getActiveOrgId();
    const index = store.contracts.findIndex((c) => c.id === id);
    if (index === -1) return false;
    assertTenantOwns(store.contracts[index]);
    store.contracts.splice(index, 1);
    return true;
  },
};
