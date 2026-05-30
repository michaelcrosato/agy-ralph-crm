import type { CSVColumnMapping, RowValidationError } from "../../types";
import { validateImportRow } from "./import";

export function parseCSV(content: string): string[][] {
  const result: string[][] = [];
  if (!content) return result;

  const lines = content.split(/\r?\n/);
  for (const line of lines) {
    if (!line.trim()) continue;

    const row: string[] = [];
    let inQuotes = false;
    let currentCell = "";

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === "," && !inQuotes) {
        row.push(currentCell.trim());
        currentCell = "";
      } else {
        currentCell += char;
      }
    }
    row.push(currentCell.trim());
    result.push(row);
  }
  return result;
}

export function processCSVImport(
  entityType: "lead" | "contact",
  rows: string[][],
  mapping: CSVColumnMapping,
): { valid: Record<string, unknown>[]; errors: RowValidationError[] } {
  const errors: RowValidationError[] = [];
  const valid: Record<string, unknown>[] = [];

  if (rows.length === 0) {
    return { valid, errors };
  }

  const headers = rows[0].map((h) => h.toLowerCase());
  for (let i = 1; i < rows.length; i++) {
    const { record, errors: rowErrors } = validateImportRow(
      entityType,
      headers,
      rows[i],
      mapping,
      i + 1,
    );
    if (rowErrors.length > 0) errors.push(...rowErrors);
    else if (record) valid.push(record);
  }

  return { valid, errors };
}

export function parseTimeToMinutes(timeStr: string): number {
  const [hours, minutes] = timeStr.split(":").map(Number);
  return hours * 60 + minutes;
}

export function parseUtmParams(urlStr: string) {
  try {
    const url = new URL(urlStr);
    return {
      utmSource: url.searchParams.get("utm_source") || null,
      utmMedium: url.searchParams.get("utm_medium") || null,
      utmCampaign: url.searchParams.get("utm_campaign") || null,
      utmTerm: url.searchParams.get("utm_term") || null,
      utmContent: url.searchParams.get("utm_content") || null,
    };
  } catch {
    const getParam = (name: string) => {
      const match = urlStr.match(new RegExp(`[?&]${name}=([^&#]*)`));
      return match ? decodeURIComponent(match[1]) : null;
    };
    return {
      utmSource: getParam("utm_source"),
      utmMedium: getParam("utm_medium"),
      utmCampaign: getParam("utm_campaign"),
      utmTerm: getParam("utm_term"),
      utmContent: getParam("utm_content"),
    };
  }
}

export * from "./import";
