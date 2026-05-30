import { genId } from "../_ids";
import { assertTenantOwns } from "../_rls";
import type { DBLeadAssignmentRule } from "../_store";
import { store } from "../_store";
import { getActiveOrgId } from "../_tenant";

export const leadAssignmentRulesStore = {
  findMany: async () => {
    const orgId = getActiveOrgId();
    return store.leadAssignmentRules.filter((r) => r.orgId === orgId);
  },
  findOne: async (id: string) => {
    const orgId = getActiveOrgId();
    const r = store.leadAssignmentRules.find((x) => x.id === id);
    if (r && r.orgId !== orgId) return null;
    return r || null;
  },
  insert: async (rule: Omit<DBLeadAssignmentRule, "id" | "createdAt">) => {
    const _orgId = getActiveOrgId();
    assertTenantOwns(rule);
    const newRule: DBLeadAssignmentRule = {
      ...rule,
      id: genId("rule"),
      createdAt: new Date(),
    };
    store.leadAssignmentRules.push(newRule);
    return newRule;
  },
  update: async (
    id: string,
    updates: Partial<Omit<DBLeadAssignmentRule, "id" | "orgId" | "createdAt">>,
  ) => {
    const _orgId = getActiveOrgId();
    const index = store.leadAssignmentRules.findIndex((r) => r.id === id);
    if (index === -1) return null;
    assertTenantOwns(store.leadAssignmentRules[index]);
    store.leadAssignmentRules[index] = {
      ...store.leadAssignmentRules[index],
      ...updates,
    };
    return store.leadAssignmentRules[index];
  },
};
