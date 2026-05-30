import { genId } from "../_ids";
import { assertTenantOwns } from "../_rls";
import type { DBReport } from "../_store";
import { store } from "../_store";
import { getActiveOrgId } from "../_tenant";

export const reportsStore = {
  findMany: async () => {
    const orgId = getActiveOrgId();
    return store.reports.filter((r) => r.orgId === orgId);
  },
  findOne: async (id: string) => {
    const orgId = getActiveOrgId();
    const report = store.reports.find((r) => r.id === id);
    if (report && report.orgId !== orgId) {
      return null;
    }
    return report || null;
  },
  insert: async (report: Omit<DBReport, "id" | "createdAt">) => {
    const _orgId = getActiveOrgId();
    assertTenantOwns(report);
    const newReport: DBReport = {
      ...report,
      id: genId("report"),
      createdAt: new Date(),
    };
    store.reports.push(newReport);
    return newReport;
  },
};
