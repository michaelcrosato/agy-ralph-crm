import { genId } from "../_ids";
import { assertTenantOwns } from "../_rls";
import type { DBAuditLog } from "../_store";
import { store } from "../_store";
import { getActiveOrgId } from "../_tenant";

export const auditLogsStore = {
  findMany: async () => {
    const orgId = getActiveOrgId();
    return store.auditLogs.filter((log) => log.orgId === orgId);
  },
  insert: async (log: Omit<DBAuditLog, "id" | "createdAt">) => {
    const _orgId = getActiveOrgId();
    assertTenantOwns(log);
    const newLog: DBAuditLog = {
      ...log,
      id: genId("log"),
      createdAt: (log as any).createdAt || new Date(),
    };
    store.auditLogs.push(newLog);
    return newLog;
  },
};
