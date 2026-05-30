import { genId } from "../_ids";
import { assertTenantOwns } from "../_rls";
import type { DBLeadAssignmentRuleEntry } from "../_store";
import { store } from "../_store";
import { getActiveOrgId } from "../_tenant";

export const leadAssignmentRuleEntriesStore = {
  findMany: async () => {
    const orgId = getActiveOrgId();
    return store.leadAssignmentRuleEntries.filter((e) => e.orgId === orgId);
  },
  findOne: async (id: string) => {
    const orgId = getActiveOrgId();
    const e = store.leadAssignmentRuleEntries.find((x) => x.id === id);
    if (e && e.orgId !== orgId) return null;
    return e || null;
  },
  insert: async (entry: Omit<DBLeadAssignmentRuleEntry, "id">) => {
    const _orgId = getActiveOrgId();
    assertTenantOwns(entry);
    const newEntry: DBLeadAssignmentRuleEntry = {
      ...entry,
      id: genId("entry"),
    };
    store.leadAssignmentRuleEntries.push(newEntry);
    return newEntry;
  },
  update: async (
    id: string,
    updates: Partial<Omit<DBLeadAssignmentRuleEntry, "id" | "orgId">>,
  ) => {
    const _orgId = getActiveOrgId();
    const index = store.leadAssignmentRuleEntries.findIndex((e) => e.id === id);
    if (index === -1) return null;
    assertTenantOwns(store.leadAssignmentRuleEntries[index]);
    store.leadAssignmentRuleEntries[index] = {
      ...store.leadAssignmentRuleEntries[index],
      ...updates,
    };
    return store.leadAssignmentRuleEntries[index];
  },
};
