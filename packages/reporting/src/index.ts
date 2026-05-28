export const REPORTING_VERSION = "0.1.0";

export interface ReportRunResult {
  reportName: string;
  groupBy: string;
  aggregateFunc: string;
  aggregateField: string | null;
  data: {
    group: string;
    value: number;
  }[];
}

export function runReport(params: {
  name: string;
  records: Record<string, unknown>[];
  groupBy: string;
  aggregateField?: string | null;
  aggregateFunc: "count" | "sum" | "avg";
}): ReportRunResult {
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
        const numbers = groupRecords.map((rec) => {
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
        const sum = numbers.reduce((a, b) => a + b, 0);
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
