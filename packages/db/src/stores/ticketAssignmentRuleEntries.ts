import { genId } from "../_ids";
import { assertTenantOwns } from "../_rls";
import type { DBTicketAssignmentRuleEntry } from "../_store";
import { store } from "../_store";
import { getActiveOrgId } from "../_tenant";

export const ticketAssignmentRuleEntriesStore = {
  findMany: async () => {
    const orgId = getActiveOrgId();
    return store.ticketAssignmentRuleEntries.filter((e) => e.orgId === orgId);
  },
  findOne: async (id: string) => {
    const orgId = getActiveOrgId();
    const entry = store.ticketAssignmentRuleEntries.find((e) => e.id === id);
    if (entry && entry.orgId !== orgId) {
      return null;
    }
    return entry || null;
  },
  insert: async (entry: Omit<DBTicketAssignmentRuleEntry, "id">) => {
    const _orgId = getActiveOrgId();
    assertTenantOwns(entry);
    const newEntry: DBTicketAssignmentRuleEntry = {
      ...entry,
      id: genId("trent"),
    };
    store.ticketAssignmentRuleEntries.push(newEntry);
    return newEntry;
  },
  update: async (
    id: string,
    updates: Partial<
      Omit<DBTicketAssignmentRuleEntry, "id" | "orgId" | "ruleId">
    >,
  ) => {
    const _orgId = getActiveOrgId();
    const index = store.ticketAssignmentRuleEntries.findIndex(
      (e) => e.id === id,
    );
    if (index === -1) return null;
    assertTenantOwns(store.ticketAssignmentRuleEntries[index]);
    store.ticketAssignmentRuleEntries[index] = {
      ...store.ticketAssignmentRuleEntries[index],
      ...updates,
    };
    return store.ticketAssignmentRuleEntries[index];
  },
};
