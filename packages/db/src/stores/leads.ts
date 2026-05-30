import { genId } from "../_ids";
import { validateCustomFields } from "../_jsonb";
import { assertTenantOwns } from "../_rls";
import type { DBLead } from "../_store";
import { store } from "../_store";
import { getActiveOrgId } from "../_tenant";

export const leadsStore = {
  findMany: async () => {
    const orgId = getActiveOrgId();
    return store.leads.filter((lead) => lead.orgId === orgId);
  },
  findOne: async (id: string) => {
    const orgId = getActiveOrgId();
    const lead = store.leads.find((l) => l.id === id);
    if (lead && lead.orgId !== orgId) {
      return null;
    }
    return lead || null;
  },
  insert: async (lead: Omit<DBLead, "id">) => {
    const orgId = getActiveOrgId();
    assertTenantOwns(lead);
    await validateCustomFields(orgId, "leads", (lead.custom as any) || {});
    const newLead: DBLead = {
      ...lead,
      id: genId("lead"),
    };
    store.leads.push(newLead);
    return newLead;
  },
  update: async (
    id: string,
    updates: Partial<Omit<DBLead, "id" | "orgId">>,
  ) => {
    const orgId = getActiveOrgId();
    const index = store.leads.findIndex((l) => l.id === id);
    if (index === -1) return null;
    assertTenantOwns(store.leads[index]);
    if (updates.custom !== undefined) {
      await validateCustomFields(orgId, "leads", (updates.custom as any) || {});
    }
    store.leads[index] = { ...store.leads[index], ...updates };
    return store.leads[index];
  },
  delete: async (id: string) => {
    const _orgId = getActiveOrgId();
    const index = store.leads.findIndex((l) => l.id === id);
    if (index === -1) return false;
    assertTenantOwns(store.leads[index]);
    store.leads.splice(index, 1);
    return true;
  },
};
