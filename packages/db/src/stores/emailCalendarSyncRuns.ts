import { genId } from "../_ids";
import { assertTenantOwns } from "../_rls";
import type { DBEmailCalendarSyncRun } from "../_store";
import { store } from "../_store";
import { getActiveOrgId } from "../_tenant";

export const emailCalendarSyncRunsStore = {
  findMany: async () => {
    const orgId = getActiveOrgId();
    return store.emailCalendarSyncRuns.filter((r) => r.orgId === orgId);
  },
  insert: async (run: Omit<DBEmailCalendarSyncRun, "id">) => {
    const _orgId = getActiveOrgId();
    assertTenantOwns(run);
    const newRun: DBEmailCalendarSyncRun = {
      ...run,
      id: genId("run"),
    };
    store.emailCalendarSyncRuns.push(newRun);
    return newRun;
  },
};
