import { genId } from "../_ids";
import { assertTenantOwns } from "../_rls";
import type { DBOpportunityStageHistory } from "../_store";
import { store } from "../_store";
import { getActiveOrgId } from "../_tenant";

export const opportunityStageHistoryStore = {
  findMany: async () => {
    const orgId = getActiveOrgId();
    return store.opportunityStageHistory.filter((h) => h.orgId === orgId);
  },
  findForOpportunity: async (opportunityId: string) => {
    const orgId = getActiveOrgId();
    return store.opportunityStageHistory.filter(
      (h) => h.opportunityId === opportunityId && h.orgId === orgId,
    );
  },
  insert: async (
    history: Omit<DBOpportunityStageHistory, "id" | "createdAt">,
  ) => {
    const _orgId = getActiveOrgId();
    assertTenantOwns(history);
    const newHistory: DBOpportunityStageHistory = {
      ...history,
      id: genId("history"),
      createdAt: new Date(),
    };
    store.opportunityStageHistory.push(newHistory);
    return newHistory;
  },
};
