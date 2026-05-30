import { genId } from "../_ids";
import { assertTenantOwns } from "../_rls";
import type { DBCampaign } from "../_store";
import { store } from "../_store";
import { getActiveOrgId } from "../_tenant";

export const campaignsStore = {
  findMany: async () => {
    const orgId = getActiveOrgId();
    return store.campaigns.filter((c) => c.orgId === orgId);
  },
  findOne: async (id: string) => {
    const orgId = getActiveOrgId();
    const c = store.campaigns.find((x) => x.id === id);
    if (c && c.orgId !== orgId) return null;
    return c || null;
  },
  findOnePublic: async (id: string) => {
    return store.campaigns.find((x) => x.id === id) || null;
  },
  insert: async (campaign: Omit<DBCampaign, "id" | "createdAt">) => {
    const _orgId = getActiveOrgId();
    assertTenantOwns(campaign);
    const newCampaign: DBCampaign = {
      ...campaign,
      id: genId("campaign"),
      createdAt: new Date(),
    };
    store.campaigns.push(newCampaign);
    return newCampaign;
  },
  update: async (
    id: string,
    updates: Partial<Omit<DBCampaign, "id" | "orgId" | "createdAt">>,
  ) => {
    const _orgId = getActiveOrgId();
    const index = store.campaigns.findIndex((c) => c.id === id);
    if (index === -1) return null;
    assertTenantOwns(store.campaigns[index]);
    store.campaigns[index] = {
      ...store.campaigns[index],
      ...updates,
    };
    return store.campaigns[index];
  },
  delete: async (id: string) => {
    const _orgId = getActiveOrgId();
    const index = store.campaigns.findIndex((c) => c.id === id);
    if (index === -1) return false;
    assertTenantOwns(store.campaigns[index]);
    store.campaigns.splice(index, 1);
    return true;
  },
};
