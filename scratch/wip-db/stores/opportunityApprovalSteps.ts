import { genId } from "../_ids";
import { assertTenantOwns } from "../_rls";
import type { DBOpportunityApprovalStep } from "../_store";
import { store } from "../_store";
import { getActiveOrgId } from "../_tenant";

export const opportunityApprovalStepsStore = {
  findMany: async () => {
    const orgId = getActiveOrgId();
    return store.opportunityApprovalSteps.filter((s) => s.orgId === orgId);
  },
  findOne: async (id: string) => {
    const orgId = getActiveOrgId();
    const s = store.opportunityApprovalSteps.find((x) => x.id === id);
    if (s && s.orgId !== orgId) return null;
    return s || null;
  },
  insert: async (step: Omit<DBOpportunityApprovalStep, "id">) => {
    const _orgId = getActiveOrgId();
    assertTenantOwns(step);
    const newStep: DBOpportunityApprovalStep = {
      ...step,
      id: genId("step"),
    };
    store.opportunityApprovalSteps.push(newStep);
    return newStep;
  },
  update: async (
    id: string,
    updates: Partial<Omit<DBOpportunityApprovalStep, "id" | "orgId">>,
  ) => {
    const _orgId = getActiveOrgId();
    const index = store.opportunityApprovalSteps.findIndex((s) => s.id === id);
    if (index === -1) return null;
    assertTenantOwns(store.opportunityApprovalSteps[index]);
    store.opportunityApprovalSteps[index] = {
      ...store.opportunityApprovalSteps[index],
      ...updates,
    };
    return store.opportunityApprovalSteps[index];
  },
};
