export const AUDIT_VERSION = "0.1.0";

export interface AuditLogInsert {
  orgId: string;
  recordId: string;
  recordType: string;
  action: "create" | "update" | "delete";
  userId: string;
  changes: Record<string, { before: unknown; after: unknown }> | null;
}

// formatAuditLog creates a clean, validated audit log database payload
export function formatAuditLog(entry: AuditLogInsert) {
  return {
    orgId: entry.orgId,
    recordId: entry.recordId,
    recordType: entry.recordType,
    action: entry.action,
    userId: entry.userId,
    changes: entry.changes,
    createdAt: new Date(),
  };
}

export interface TimelineLogInput {
  id: string;
  action: string;
  userId: string;
  createdAt: Date;
  changes: Record<string, { before: unknown; after: unknown }> | null;
}

// formatTimeline compiles chronological audit changes into standard timeline entries
export function formatTimeline(logs: TimelineLogInput[]) {
  return logs.map((log) => ({
    id: log.id,
    action: log.action,
    userId: log.userId,
    timestamp: log.createdAt,
    summary: `Record was ${log.action}d by user ${log.userId}`,
    details: log.changes,
  }));
}
