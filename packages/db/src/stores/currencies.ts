import { genId } from "../_ids";
import { assertTenantOwns } from "../_rls";
import type { DBCurrency } from "../_store";
import { store } from "../_store";
import { getActiveOrgId } from "../_tenant";

export const currenciesStore = {
  findMany: async () => {
    const orgId = getActiveOrgId();
    return store.currencies.filter((c) => c.orgId === orgId);
  },
  findOne: async (id: string) => {
    const orgId = getActiveOrgId();
    const c = store.currencies.find((x) => x.id === id);
    if (c && c.orgId !== orgId) {
      return null;
    }
    return c || null;
  },
  findByIsoCode: async (isoCode: string) => {
    const orgId = getActiveOrgId();
    const c = store.currencies.find(
      (x) =>
        x.isoCode.toLowerCase() === isoCode.toLowerCase() && x.orgId === orgId,
    );
    return c || null;
  },
  insert: async (c: Omit<DBCurrency, "id" | "createdAt" | "updatedAt">) => {
    const _orgId = getActiveOrgId();
    assertTenantOwns(c);
    const newCurrency: DBCurrency = {
      ...c,
      id: genId("currency"),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    store.currencies.push(newCurrency);
    return newCurrency;
  },
  update: async (
    id: string,
    updates: Partial<
      Omit<DBCurrency, "id" | "orgId" | "createdAt" | "updatedAt">
    >,
  ) => {
    const _orgId = getActiveOrgId();
    const index = store.currencies.findIndex((c) => c.id === id);
    if (index === -1) return null;
    assertTenantOwns(store.currencies[index]);
    store.currencies[index] = {
      ...store.currencies[index],
      ...updates,
      updatedAt: new Date(),
    };
    return store.currencies[index];
  },
};
