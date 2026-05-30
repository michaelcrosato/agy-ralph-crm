import { genId } from "../_ids";
import { assertTenantOwns } from "../_rls";
import type { DBLeadScoringRule } from "../_store";
import { store } from "../_store";
import { getActiveOrgId } from "../_tenant";

export const leadScoringRulesStore = {
  findMany: async () => {
    const orgId = getActiveOrgId();
    return store.leadScoringRules.filter((r) => r.orgId === orgId);
  },
  findOne: async (id: string) => {
    const orgId = getActiveOrgId();
    const r = store.leadScoringRules.find((x) => x.id === id);
    if (r && r.orgId !== orgId) {
      return null;
    }
    return r || null;
  },
  insert: async (r: Omit<DBLeadScoringRule, "id" | "createdAt">) => {
    const _orgId = getActiveOrgId();
    assertTenantOwns(r);
    const newRule: DBLeadScoringRule = {
      ...r,
      id: genId("rule"),
      createdAt: new Date(),
    };
    store.leadScoringRules.push(newRule);
    return newRule;
  },
  update: async (
    id: string,
    updates: Partial<Omit<DBLeadScoringRule, "id" | "orgId" | "createdAt">>,
  ) => {
    const _orgId = getActiveOrgId();
    const index = store.leadScoringRules.findIndex((r) => r.id === id);
    if (index === -1) return null;
    assertTenantOwns(store.leadScoringRules[index]);
    store.leadScoringRules[index] = {
      ...store.leadScoringRules[index],
      ...updates,
    };
    return store.leadScoringRules[index];
  },
  delete: async (id: string) => {
    const _orgId = getActiveOrgId();
    const index = store.leadScoringRules.findIndex((r) => r.id === id);
    if (index === -1) return false;
    assertTenantOwns(store.leadScoringRules[index]);
    store.leadScoringRules.splice(index, 1);
    return true;
  },
};
