import { genId } from "../_ids";
import { assertTenantOwns } from "../_rls";
import type { DBOpportunityApproval } from "../_store";
import { store } from "../_store";
import { getActiveOrgId } from "../_tenant";

export const opportunityApprovalsStore = {
  findMany: async () => {
    const orgId = getActiveOrgId();
    return store.opportunityApprovals.filter((a) => a.orgId === orgId);
  },
  findOne: async (id: string) => {
    const orgId = getActiveOrgId();
    const a = store.opportunityApprovals.find((x) => x.id === id);
    if (a && a.orgId !== orgId) return null;
    return a || null;
  },
  insert: async (appr: Omit<DBOpportunityApproval, "id" | "createdAt">) => {
    const _orgId = getActiveOrgId();
    assertTenantOwns(appr);
    const newAppr: DBOpportunityApproval = {
      ...appr,
      id: genId("approval"),
      createdAt: new Date(),
    };
    store.opportunityApprovals.push(newAppr);
    return newAppr;
  },
  update: async (
    id: string,
    updates: Partial<Omit<DBOpportunityApproval, "id" | "orgId" | "createdAt">>,
  ) => {
    const _orgId = getActiveOrgId();
    const index = store.opportunityApprovals.findIndex((a) => a.id === id);
    if (index === -1) return null;
    assertTenantOwns(store.opportunityApprovals[index]);
    store.opportunityApprovals[index] = {
      ...store.opportunityApprovals[index],
      ...updates,
    };
    return store.opportunityApprovals[index];
  },
};
