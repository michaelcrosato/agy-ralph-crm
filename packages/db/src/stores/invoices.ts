import { genId } from "../_ids";
import { assertTenantOwns } from "../_rls";
import type { DBInvoice } from "../_store";
import { store } from "../_store";
import { getActiveOrgId } from "../_tenant";

export const invoicesStore = {
  findMany: async () => {
    const orgId = getActiveOrgId();
    return store.invoices.filter((i) => i.orgId === orgId);
  },
  findOne: async (id: string) => {
    const orgId = getActiveOrgId();
    const i = store.invoices.find((x) => x.id === id);
    if (i && i.orgId !== orgId) return null;
    return i || null;
  },
  insert: async (inv: Omit<DBInvoice, "id">) => {
    const _orgId = getActiveOrgId();
    assertTenantOwns(inv);
    const newInv: DBInvoice = {
      ...inv,
      id: genId("invoice"),
    };
    store.invoices.push(newInv);
    return newInv;
  },
  update: async (
    id: string,
    updates: Partial<Omit<DBInvoice, "id" | "orgId">>,
  ) => {
    const _orgId = getActiveOrgId();
    const index = store.invoices.findIndex((i) => i.id === id);
    if (index === -1) return null;
    assertTenantOwns(store.invoices[index]);
    store.invoices[index] = {
      ...store.invoices[index],
      ...updates,
    };
    return store.invoices[index];
  },
};
