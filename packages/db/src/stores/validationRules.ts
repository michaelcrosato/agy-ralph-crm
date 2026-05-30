import { genId } from "../_ids";
import { assertTenantOwns } from "../_rls";
import type { DBValidationRule } from "../_store";
import { store } from "../_store";
import { getActiveOrgId } from "../_tenant";

export const validationRulesStore = {
  findMany: async () => {
    const orgId = getActiveOrgId();
    return store.validationRules.filter((r) => r.orgId === orgId);
  },
  findOne: async (id: string) => {
    const orgId = getActiveOrgId();
    const r = store.validationRules.find((x) => x.id === id);
    if (r && r.orgId !== orgId) return null;
    return r || null;
  },
  insert: async (
    r: Omit<DBValidationRule, "id" | "createdAt" | "updatedAt">,
  ) => {
    const _orgId = getActiveOrgId();
    assertTenantOwns(r);
    const newRule: DBValidationRule = {
      ...r,
      id: genId("valrule"),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    store.validationRules.push(newRule);
    return newRule;
  },
  update: async (
    id: string,
    updates: Partial<
      Omit<DBValidationRule, "id" | "orgId" | "createdAt" | "updatedAt">
    >,
  ) => {
    const _orgId = getActiveOrgId();
    const index = store.validationRules.findIndex((x) => x.id === id);
    if (index === -1) return null;
    assertTenantOwns(store.validationRules[index]);
    store.validationRules[index] = {
      ...store.validationRules[index],
      ...updates,
      updatedAt: new Date(),
    };
    return store.validationRules[index];
  },
  delete: async (id: string) => {
    const _orgId = getActiveOrgId();
    const index = store.validationRules.findIndex((x) => x.id === id);
    if (index === -1) return false;
    assertTenantOwns(store.validationRules[index]);
    store.validationRules.splice(index, 1);
    return true;
  },
};
