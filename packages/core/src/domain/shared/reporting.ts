import type {
  CoreReportRunResult,
  CoreScheduledReport,
  CoreScheduledReportRun,
  FolderNode,
} from "../../types";

export function calculateNextRunDate(
  fromDate: Date,
  frequency: "daily" | "weekly" | "monthly",
): Date {
  const next = new Date(fromDate.getTime());
  if (frequency === "daily") {
    next.setDate(next.getDate() + 1);
  } else if (frequency === "weekly") {
    next.setDate(next.getDate() + 7);
  } else if (frequency === "monthly") {
    next.setMonth(next.getMonth() + 1);
  }
  return next;
}

export function runReportInline(params: {
  name: string;
  records: Record<string, unknown>[];
  groupBy: string;
  aggregateField?: string | null;
  aggregateFunc: "count" | "sum" | "avg";
}): {
  reportName: string;
  groupBy: string;
  aggregateFunc: "count" | "sum" | "avg";
  aggregateField: string | null;
  data: { group: string; value: number }[];
} {
  const { name, records, groupBy, aggregateField, aggregateFunc } = params;

  const groups: Record<string, Record<string, unknown>[]> = {};
  for (const rec of records) {
    let val = rec[groupBy];
    if (val === undefined && rec.custom && typeof rec.custom === "object") {
      const customObj = rec.custom as Record<string, unknown>;
      val = customObj[groupBy];
    }
    const groupKey = val !== undefined && val !== null ? String(val) : "None";
    if (!groups[groupKey]) {
      groups[groupKey] = [];
    }
    groups[groupKey].push(rec);
  }

  const results = Object.entries(groups).map(([group, groupRecords]) => {
    let value = 0;
    if (aggregateFunc === "count") {
      value = groupRecords.length;
    } else {
      const field = aggregateField;
      if (!field) {
        value = groupRecords.length;
      } else {
        const numbers = groupRecords.map((rec: Record<string, unknown>) => {
          let val = rec[field];
          if (
            val === undefined &&
            rec.custom &&
            typeof rec.custom === "object"
          ) {
            const customObj = rec.custom as Record<string, unknown>;
            val = customObj[field];
          }
          const parsed = Number(val);
          return Number.isNaN(parsed) ? 0 : parsed;
        });
        const sum = numbers.reduce((a: number, b: number) => a + b, 0);
        if (aggregateFunc === "sum") {
          value = sum;
        } else if (aggregateFunc === "avg") {
          value = groupRecords.length > 0 ? sum / groupRecords.length : 0;
        }
      }
    }

    if (aggregateFunc === "avg") {
      value = Math.round(value * 100) / 100;
    }

    return {
      group,
      value,
    };
  });

  results.sort((a, b) => a.group.localeCompare(b.group));

  return {
    reportName: name,
    groupBy,
    aggregateFunc,
    aggregateField: aggregateField || null,
    data: results,
  };
}

export async function runPendingScheduledReports(
  dbStore: {
    scheduledReports: {
      findMany: () => Promise<CoreScheduledReport[]>;
      update: (
        id: string,
        updates: Partial<CoreScheduledReport>,
      ) => Promise<CoreScheduledReport | null>;
    };
    scheduledReportRuns: {
      insert: (
        r: Omit<CoreScheduledReportRun, "id" | "runAt">,
      ) => Promise<CoreScheduledReportRun>;
    };
    reports: {
      findOne: (id: string) => Promise<{
        id: string;
        orgId: string;
        name: string;
        objectType: string;
        groupBy: string;
        aggregateField: string | null;
        aggregateFunc: string;
      } | null>;
    };
  },
  _store: Record<string, unknown[]>,
  orgId: string,
  triggerWebhook?: (
    orgId: string,
    event: string,
    payload: {
      scheduleId: string;
      reportId: string;
      recipientEmail: string;
      result: CoreReportRunResult;
    },
  ) => Promise<void>,
): Promise<number> {
  const now = new Date();
  const allSchedules = await dbStore.scheduledReports.findMany();
  const pendingSchedules = allSchedules.filter(
    (s) => s.isActive === 1 && new Date(s.nextRunAt) <= now,
  );

  let processedCount = 0;

  for (const schedule of pendingSchedules) {
    let runStatus: "success" | "failed" = "success";
    let errorMessage: string | null = null;
    let reportResult: CoreReportRunResult | null = null;

    try {
      const report = await dbStore.reports.findOne(schedule.reportId);
      if (!report) {
        throw new Error(`Report with ID ${schedule.reportId} not found.`);
      }

      const objectType = report.objectType;
      const objectStore = (
        dbStore as unknown as Record<
          string,
          { findMany: () => Promise<unknown[]> }
        >
      )[objectType];
      if (!objectStore) {
        throw new Error(`Unsupported report object type: ${objectType}`);
      }
      const records = await objectStore.findMany();

      reportResult = runReportInline({
        name: report.name,
        records: records as Record<string, unknown>[],
        groupBy: report.groupBy,
        aggregateField: report.aggregateField,
        aggregateFunc: report.aggregateFunc as "count" | "sum" | "avg",
      });
    } catch (err) {
      runStatus = "failed";
      errorMessage = err instanceof Error ? err.message : String(err);
    }

    await dbStore.scheduledReportRuns.insert({
      orgId,
      scheduledReportId: schedule.id,
      status: runStatus,
      errorMessage,
    });

    const nextRun = calculateNextRunDate(
      new Date(schedule.nextRunAt),
      schedule.frequency,
    );
    await dbStore.scheduledReports.update(schedule.id, {
      nextRunAt: nextRun,
    });

    if (runStatus === "success" && triggerWebhook) {
      await triggerWebhook(orgId, "report.delivered", {
        scheduleId: schedule.id,
        reportId: schedule.reportId,
        recipientEmail: schedule.recipientEmail,
        result: reportResult as CoreReportRunResult,
      });
    }

    processedCount++;
  }

  return processedCount;
}

export function isDateInPeriod(date: Date, period: string): boolean {
  if (!date || Number.isNaN(date.getTime())) return false;
  const iso = date.toISOString();
  const year = iso.substring(0, 4);
  const monthStr = iso.substring(5, 7);
  const month = Number.parseInt(monthStr, 10);

  if (period.includes("-Q")) {
    const [qYear, qStr] = period.split("-Q");
    if (year !== qYear) return false;
    const quarter = Math.ceil(month / 3);
    return quarter.toString() === qStr;
  }
  return iso.substring(0, 7) === period;
}

export function detectFolderLoop(
  folderId: string,
  newParentId: string | null,
  allFolders: FolderNode[],
): boolean {
  if (!newParentId) return false;
  if (folderId === newParentId) return true;

  let currentId: string | null = newParentId;
  const visited = new Set<string>();

  while (currentId) {
    if (visited.has(currentId)) {
      return true; // Loop detected
    }
    visited.add(currentId);
    if (currentId === folderId) {
      return true; // Loop through ancestor/descendant detected
    }
    const parentNode = allFolders.find((f) => f.id === currentId);
    currentId = parentNode ? parentNode.parentFolderId : null;
  }
  return false;
}
