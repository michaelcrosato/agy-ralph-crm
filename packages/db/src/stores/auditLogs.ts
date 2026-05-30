import { genId } from "../_ids";
import { assertTenantOwns } from "../_rls";
import type { DBAuditLog } from "../_store";
import { store } from "../_store";
import { getActiveOrgId } from "../_tenant";
import { computeAuditHash, GENESIS_HASH } from "./audit-hash";

export const auditLogsStore = {
  findMany: async () => {
    const orgId = getActiveOrgId();
    return store.auditLogs.filter((log) => log.orgId === orgId);
  },
  insert: async (log: Omit<DBAuditLog, "id" | "createdAt">) => {
    const orgId = getActiveOrgId();
    const fullLog = {
      ...log,
    } as DBAuditLog;
    if (!fullLog.orgId) {
      fullLog.orgId = orgId;
    }
    assertTenantOwns(fullLog);

    // Get all existing logs for this org in mock store to determine last seq & hash
    const orgLogs = store.auditLogs.filter((l) => l.orgId === orgId);
    const lastLog = orgLogs[orgLogs.length - 1];

    const prevHash = lastLog?.hash || GENESIS_HASH;
    const seq = lastLog ? (lastLog.seq || 0) + 1 : 0;
    const createdAt = (log as any).createdAt || new Date();

    const recordToHash = {
      orgId,
      recordId: fullLog.recordId,
      recordType: fullLog.recordType,
      action: fullLog.action,
      userId: fullLog.userId,
      changes: fullLog.changes,
      createdAt: createdAt.toISOString(),
    };

    const hash = computeAuditHash(recordToHash, seq, prevHash);

    const newLog: DBAuditLog = {
      ...fullLog,
      id: genId("log"),
      seq,
      prevHash,
      hash,
      createdAt,
    };
    store.auditLogs.push(newLog);
    return newLog;
  },
};
