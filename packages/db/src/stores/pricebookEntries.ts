import { genId } from "../_ids";
import { assertTenantOwns } from "../_rls";
import type { DBPricebookEntry } from "../_store";
import { store } from "../_store";
import { getActiveOrgId } from "../_tenant";

export const pricebookEntriesStore = {
  findMany: async () => {
    const orgId = getActiveOrgId();
    return store.pricebookEntries.filter((pbe) => pbe.orgId === orgId);
  },
  findOne: async (id: string) => {
    const orgId = getActiveOrgId();
    const pbe = store.pricebookEntries.find((x) => x.id === id);
    if (pbe && pbe.orgId !== orgId) return null;
    return pbe || null;
  },
  insert: async (pbe: Omit<DBPricebookEntry, "id">) => {
    const _orgId = getActiveOrgId();
    assertTenantOwns(pbe);
    const newPbe: DBPricebookEntry = {
      ...pbe,
      id: genId("pbe"),
    };
    store.pricebookEntries.push(newPbe);
    return newPbe;
  },
};
