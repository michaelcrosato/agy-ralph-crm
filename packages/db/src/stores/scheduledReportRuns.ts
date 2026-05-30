import { genId } from "../_ids";
import { assertTenantOwns } from "../_rls";
import type { DBScheduledReportRun } from "../_store";
import { store } from "../_store";
import { getActiveOrgId } from "../_tenant";

export const scheduledReportRunsStore = {
  findMany: async () => {
    const orgId = getActiveOrgId();
    return store.scheduledReportRuns.filter((r) => r.orgId === orgId);
  },
  findOne: async (id: string) => {
    const orgId = getActiveOrgId();
    const r = store.scheduledReportRuns.find((x) => x.id === id);
    if (r && r.orgId !== orgId) {
      return null;
    }
    return r || null;
  },
  insert: async (
    r: Omit<DBScheduledReportRun, "id" | "runAt"> & { runAt?: Date },
  ) => {
    const _orgId = getActiveOrgId();
    assertTenantOwns(r);
    const newRun: DBScheduledReportRun = {
      ...r,
      id: genId("srr"),
      runAt: r.runAt || new Date(),
    };
    store.scheduledReportRuns.push(newRun);
    return newRun;
  },
};
