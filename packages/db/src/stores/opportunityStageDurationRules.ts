import { genId } from "../_ids";
import { assertTenantOwns } from "../_rls";
import type { DBOpportunityStageDurationRule } from "../_store";
import { store } from "../_store";
import { getActiveOrgId } from "../_tenant";

export const opportunityStageDurationRulesStore = {
  findMany: async () => {
    const orgId = getActiveOrgId();
    return store.opportunityStageDurationRules.filter((r) => r.orgId === orgId);
  },
  findByStage: async (stage: string) => {
    const orgId = getActiveOrgId();
    const r = store.opportunityStageDurationRules.find(
      (x) => x.stage === stage && x.orgId === orgId,
    );
    return r || null;
  },
  upsert: async (
    rule: Omit<
      DBOpportunityStageDurationRule,
      "id" | "createdAt" | "updatedAt"
    >,
  ) => {
    const orgId = getActiveOrgId();
    assertTenantOwns(rule);
    const existingIndex = store.opportunityStageDurationRules.findIndex(
      (x) => x.stage === rule.stage && x.orgId === orgId,
    );
    const now = new Date();
    if (existingIndex > -1) {
      store.opportunityStageDurationRules[existingIndex] = {
        ...store.opportunityStageDurationRules[existingIndex],
        maxDaysAllowed: rule.maxDaysAllowed,
        updatedAt: now,
      };
      return store.opportunityStageDurationRules[existingIndex];
    }
    const newRule: DBOpportunityStageDurationRule = {
      ...rule,
      id: genId("duration-rule"),
      createdAt: now,
      updatedAt: now,
    };
    store.opportunityStageDurationRules.push(newRule);
    return newRule;
  },
};
