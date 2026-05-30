import { genId } from "../_ids";
import { assertTenantOwns } from "../_rls";
import type { DBOpportunityProductSchedule } from "../_store";
import { store } from "../_store";
import { getActiveOrgId } from "../_tenant";

export const opportunityProductSchedulesStore = {
  findForProduct: async (opportunityProductId: string) => {
    const orgId = getActiveOrgId();
    return store.opportunityProductSchedules.filter(
      (s) =>
        s.opportunityProductId === opportunityProductId && s.orgId === orgId,
    );
  },
  findOne: async (id: string) => {
    const orgId = getActiveOrgId();
    const s = store.opportunityProductSchedules.find((x) => x.id === id);
    if (s && s.orgId !== orgId) {
      return null;
    }
    return s || null;
  },
  insert: async (s: Omit<DBOpportunityProductSchedule, "id" | "createdAt">) => {
    const _orgId = getActiveOrgId();
    assertTenantOwns(s);
    const newSchedule: DBOpportunityProductSchedule = {
      ...s,
      id: genId("schedule"),
      createdAt: new Date(),
    };
    store.opportunityProductSchedules.push(newSchedule);
    return newSchedule;
  },
  delete: async (id: string) => {
    const _orgId = getActiveOrgId();
    const index = store.opportunityProductSchedules.findIndex(
      (s) => s.id === id,
    );
    if (index === -1) return false;
    assertTenantOwns(store.opportunityProductSchedules[index]);
    store.opportunityProductSchedules.splice(index, 1);
    return true;
  },
  deleteForProduct: async (opportunityProductId: string) => {
    const orgId = getActiveOrgId();
    // Safe filter/mutation under RLS
    const targets = store.opportunityProductSchedules.filter(
      (s) =>
        s.opportunityProductId === opportunityProductId && s.orgId === orgId,
    );
    for (const t of targets) {
      const idx = store.opportunityProductSchedules.findIndex(
        (s) => s.id === t.id,
      );
      if (idx !== -1) {
        store.opportunityProductSchedules.splice(idx, 1);
      }
    }
    return true;
  },
};
