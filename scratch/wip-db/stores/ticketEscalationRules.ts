import { genId } from "../_ids";
import { assertTenantOwns } from "../_rls";
import type { DBTicketEscalationRule } from "../_store";
import { store } from "../_store";
import { getActiveOrgId } from "../_tenant";

export const ticketEscalationRulesStore = {
  findMany: async () => {
    const orgId = getActiveOrgId();
    return store.ticketEscalationRules.filter((r) => r.orgId === orgId);
  },
  findOne: async (id: string) => {
    const orgId = getActiveOrgId();
    const rule = store.ticketEscalationRules.find((r) => r.id === id);
    if (rule && rule.orgId !== orgId) {
      return null;
    }
    return rule || null;
  },
  insert: async (
    rule: Omit<DBTicketEscalationRule, "id" | "createdAt"> & {
      createdAt?: Date;
    },
  ) => {
    const _orgId = getActiveOrgId();
    assertTenantOwns(rule);
    const newRule: DBTicketEscalationRule = {
      ...rule,
      id: genId("tescr"),
      createdAt: rule.createdAt || new Date(),
    };
    store.ticketEscalationRules.push(newRule);
    return newRule;
  },
  update: async (
    id: string,
    updates: Partial<
      Omit<DBTicketEscalationRule, "id" | "orgId" | "createdAt">
    >,
  ) => {
    const _orgId = getActiveOrgId();
    const index = store.ticketEscalationRules.findIndex((r) => r.id === id);
    if (index === -1) return null;
    assertTenantOwns(store.ticketEscalationRules[index]);
    store.ticketEscalationRules[index] = {
      ...store.ticketEscalationRules[index],
      ...updates,
    };
    return store.ticketEscalationRules[index];
  },
};
