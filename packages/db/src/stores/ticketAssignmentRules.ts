import { genId } from "../_ids";
import { assertTenantOwns } from "../_rls";
import type { DBTicketAssignmentRule } from "../_store";
import { store } from "../_store";
import { getActiveOrgId } from "../_tenant";

export const ticketAssignmentRulesStore = {
  findMany: async () => {
    const orgId = getActiveOrgId();
    return store.ticketAssignmentRules.filter((r) => r.orgId === orgId);
  },
  findOne: async (id: string) => {
    const orgId = getActiveOrgId();
    const rule = store.ticketAssignmentRules.find((r) => r.id === id);
    if (rule && rule.orgId !== orgId) {
      return null;
    }
    return rule || null;
  },
  insert: async (
    rule: Omit<DBTicketAssignmentRule, "id" | "createdAt"> & {
      createdAt?: Date;
    },
  ) => {
    const _orgId = getActiveOrgId();
    assertTenantOwns(rule);
    const newRule: DBTicketAssignmentRule = {
      ...rule,
      id: genId("trule"),
      createdAt: rule.createdAt || new Date(),
    };
    store.ticketAssignmentRules.push(newRule);
    return newRule;
  },
  update: async (
    id: string,
    updates: Partial<
      Omit<DBTicketAssignmentRule, "id" | "orgId" | "createdAt">
    >,
  ) => {
    const _orgId = getActiveOrgId();
    const index = store.ticketAssignmentRules.findIndex((r) => r.id === id);
    if (index === -1) return null;
    assertTenantOwns(store.ticketAssignmentRules[index]);
    store.ticketAssignmentRules[index] = {
      ...store.ticketAssignmentRules[index],
      ...updates,
    };
    return store.ticketAssignmentRules[index];
  },
};
