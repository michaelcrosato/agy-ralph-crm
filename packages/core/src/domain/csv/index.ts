import type { CSVColumnMapping, RowValidationError } from "../../types";

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
  const dataRows = rows.slice(1);

  const getCellValue = (row: string[], field: string): string | null => {
    const mapVal = mapping[field];
    if (!mapVal) return null;

    if (/^\d+$/.test(mapVal)) {
      const idx = Number.parseInt(mapVal, 10);
      return row[idx] !== undefined ? row[idx] : null;
    }

    const idx = headers.indexOf(mapVal.toLowerCase());
    if (idx !== -1) {
      return row[idx] !== undefined ? row[idx] : null;
    }

    return null;
  };

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i];
    const rowNum = i + 2;

    const record: Record<string, unknown> = {};
    let rowHasError = false;

    if (entityType === "lead") {
      const company = getCellValue(row, "company");
      const email = getCellValue(row, "email");
      const status = getCellValue(row, "status") || "New";

      if (!company && !email) {
        errors.push({
          row: rowNum,
          column: "company/email",
          message: "Either Company or Email is required for Leads.",
        });
        rowHasError = true;
      }

      if (email && !email.includes("@")) {
        errors.push({
          row: rowNum,
          column: "email",
          message: `Invalid email address format: ${email}`,
        });
        rowHasError = true;
      }

      if (!rowHasError) {
        record.company = company || null;
        record.email = email || null;
        record.status = status;
      }
    } else if (entityType === "contact") {
      const firstName = getCellValue(row, "firstName");
      const lastName = getCellValue(row, "lastName");
      const email = getCellValue(row, "email");

      if (!lastName) {
        errors.push({
          row: rowNum,
          column: "lastName",
          message: "Last Name is required for Contacts.",
        });
        rowHasError = true;
      }

      if (email && !email.includes("@")) {
        errors.push({
          row: rowNum,
          column: "email",
          message: `Invalid email address format: ${email}`,
        });
        rowHasError = true;
      }

      if (!rowHasError) {
        record.firstName = firstName || "";
        record.lastName = lastName || "";
        record.email = email || null;
      }
    }

    if (!rowHasError) {
      valid.push(record);
    }
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
