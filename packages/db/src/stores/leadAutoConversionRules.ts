import { genId } from "../_ids";
import { assertTenantOwns } from "../_rls";
import type { DBLeadAutoConversionRule } from "../_store";
import { store } from "../_store";
import { getActiveOrgId } from "../_tenant";

export const leadAutoConversionRulesStore = {
  findMany: async () => {
    const orgId = getActiveOrgId();
    return store.leadAutoConversionRules.filter((r) => r.orgId === orgId);
  },
  findOne: async (id: string) => {
    const orgId = getActiveOrgId();
    const r = store.leadAutoConversionRules.find((x) => x.id === id);
    if (r && r.orgId !== orgId) return null;
    return r || null;
  },
  insert: async (rule: Omit<DBLeadAutoConversionRule, "id" | "createdAt">) => {
    const _orgId = getActiveOrgId();
    assertTenantOwns(rule);
    const newRule: DBLeadAutoConversionRule = {
      ...rule,
      id: genId("conversion-rule"),
      createdAt: new Date(),
    };
    store.leadAutoConversionRules.push(newRule);
    return newRule;
  },
  update: async (
    id: string,
    updates: Partial<
      Omit<DBLeadAutoConversionRule, "id" | "orgId" | "createdAt">
    >,
  ) => {
    const _orgId = getActiveOrgId();
    const index = store.leadAutoConversionRules.findIndex((r) => r.id === id);
    if (index === -1) return null;
    assertTenantOwns(store.leadAutoConversionRules[index]);
    store.leadAutoConversionRules[index] = {
      ...store.leadAutoConversionRules[index],
      ...updates,
    };
    return store.leadAutoConversionRules[index];
  },
};
