import { genId } from "../_ids";
import { assertTenantOwns } from "../_rls";
import type { DBScheduledReport } from "../_store";
import { store } from "../_store";
import { getActiveOrgId } from "../_tenant";

export const scheduledReportsStore = {
  findMany: async () => {
    const orgId = getActiveOrgId();
    return store.scheduledReports.filter((r) => r.orgId === orgId);
  },
  findOne: async (id: string) => {
    const orgId = getActiveOrgId();
    const r = store.scheduledReports.find((x) => x.id === id);
    if (r && r.orgId !== orgId) {
      return null;
    }
    return r || null;
  },
  insert: async (
    r: Omit<DBScheduledReport, "id" | "createdAt"> & { createdAt?: Date },
  ) => {
    const _orgId = getActiveOrgId();
    assertTenantOwns(r);
    const newReport: DBScheduledReport = {
      ...r,
      id: genId("sr"),
      createdAt: r.createdAt || new Date(),
    };
    store.scheduledReports.push(newReport);
    return newReport;
  },
  update: async (
    id: string,
    updates: Partial<Omit<DBScheduledReport, "id" | "orgId">>,
  ) => {
    const _orgId = getActiveOrgId();
    const index = store.scheduledReports.findIndex((x) => x.id === id);
    if (index === -1) return null;
    assertTenantOwns(store.scheduledReports[index]);
    store.scheduledReports[index] = {
      ...store.scheduledReports[index],
      ...updates,
    };
    return store.scheduledReports[index];
  },
  delete: async (id: string) => {
    const _orgId = getActiveOrgId();
    const index = store.scheduledReports.findIndex((x) => x.id === id);
    if (index === -1) return false;
    assertTenantOwns(store.scheduledReports[index]);
    store.scheduledReports.splice(index, 1);
    return true;
  },
};
