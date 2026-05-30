import { genId } from "../_ids";
import { assertTenantOwns } from "../_rls";
import type { DBAccount } from "../_store";
import { store } from "../_store";
import { getActiveOrgId } from "../_tenant";

export const accountsStore = {
  findMany: async () => {
    const orgId = getActiveOrgId();
    return store.accounts.filter((acc) => acc.orgId === orgId);
  },
  findOne: async (id: string) => {
    const orgId = getActiveOrgId();
    const acc = store.accounts.find((a) => a.id === id);
    if (acc && acc.orgId !== orgId) {
      return null;
    }
    return acc || null;
  },
  insert: async (acc: Omit<DBAccount, "id">) => {
    const _orgId = getActiveOrgId();
    assertTenantOwns(acc);
    const newAcc: DBAccount = {
      ...acc,
      parentAccountId: acc.parentAccountId || null,
      id: genId("account"),
    };
    store.accounts.push(newAcc);
    return newAcc;
  },
  update: async (
    id: string,
    updates: Partial<Omit<DBAccount, "id" | "orgId">>,
  ) => {
    const _orgId = getActiveOrgId();
    const index = store.accounts.findIndex((a) => a.id === id);
    if (index === -1) return null;
    assertTenantOwns(store.accounts[index]);
    store.accounts[index] = { ...store.accounts[index], ...updates };
    return store.accounts[index];
  },
  findChildren: async (parentId: string) => {
    const orgId = getActiveOrgId();
    return store.accounts.filter(
      (acc) => acc.orgId === orgId && acc.parentAccountId === parentId,
    );
  },
  findParentPath: async (accountId: string) => {
    const orgId = getActiveOrgId();
    const path: DBAccount[] = [];
    const visited = new Set<string>();
    let currentAcc = store.accounts.find(
      (a) => a.id === accountId && a.orgId === orgId,
    );

    while (currentAcc?.parentAccountId) {
      if (visited.has(currentAcc.parentAccountId)) {
        break; // Cycle protection
      }
      visited.add(currentAcc.parentAccountId);

      const parent = store.accounts.find(
        (a) => a.id === currentAcc?.parentAccountId && a.orgId === orgId,
      );
      if (!parent) break;
      path.push(parent);
      currentAcc = parent;
    }
    return path;
  },
  delete: async (id: string) => {
    const _orgId = getActiveOrgId();
    const index = store.accounts.findIndex((a) => a.id === id);
    if (index === -1) return false;
    assertTenantOwns(store.accounts[index]);
    store.accounts.splice(index, 1);
    return true;
  },
};
