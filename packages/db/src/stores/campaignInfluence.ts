import { genId } from "../_ids";
import { assertTenantOwns } from "../_rls";
import type { DBCampaignInfluence } from "../_store";
import { store } from "../_store";
import { getActiveOrgId } from "../_tenant";

export const campaignInfluenceStore = {
  findMany: async () => {
    const orgId = getActiveOrgId();
    return store.campaignInfluence.filter((r) => r.orgId === orgId);
  },
  findForOpportunity: async (opportunityId: string) => {
    const orgId = getActiveOrgId();
    return store.campaignInfluence.filter(
      (r) => r.opportunityId === opportunityId && r.orgId === orgId,
    );
  },
  findOne: async (id: string) => {
    const orgId = getActiveOrgId();
    const r = store.campaignInfluence.find((x) => x.id === id);
    if (r && r.orgId !== orgId) return null;
    return r || null;
  },
  insert: async (inf: Omit<DBCampaignInfluence, "id" | "createdAt">) => {
    const _orgId = getActiveOrgId();
    assertTenantOwns(inf);
    const newInfluence: DBCampaignInfluence = {
      ...inf,
      id: genId("cinf"),
      createdAt: new Date(),
    };
    store.campaignInfluence.push(newInfluence);
    return newInfluence;
  },
  delete: async (id: string) => {
    const _orgId = getActiveOrgId();
    const index = store.campaignInfluence.findIndex((r) => r.id === id);
    if (index === -1) return false;
    assertTenantOwns(store.campaignInfluence[index]);
    store.campaignInfluence.splice(index, 1);
    return true;
  },
};
