import type { CSVColumnMapping, RowValidationError } from "../../types";

/**
 * Streaming CSV row parser. Consumes string chunks and yields one
 * `string[]` per record while holding only the current row in memory — safe
 * for arbitrarily large files (10M+ rows). Quoted fields may span chunk
 * boundaries and may contain commas and embedded newlines. Output matches the
 * synchronous `parseCSV` for inputs without embedded newlines (blank/whitespace
 * lines are skipped; cells are trimmed).
 */
export async function* streamCsvRows(
  source: AsyncIterable<string>,
): AsyncGenerator<string[]> {
  let field = "";
  let row: string[] = [];
  let inQuotes = false;
  let sawNonWs = false;

  const endField = () => {
    row.push(field.trim());
    field = "";
  };
  const endRow = (): string[] | null => {
    endField();
    const finished = sawNonWs ? row : null;
    row = [];
    sawNonWs = false;
    return finished;
  };

  for await (const text of source) {
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (inQuotes) {
        if (ch === '"') inQuotes = false;
        else field += ch;
        continue;
      }
      if (ch === '"') {
        inQuotes = true;
        sawNonWs = true;
      } else if (ch === ",") {
        endField();
        sawNonWs = true;
      } else if (ch === "\n" || ch === "\r") {
        const finished = endRow();
        if (finished) yield finished;
      } else {
        field += ch;
        if (ch !== " " && ch !== "\t") sawNonWs = true;
      }
    }
  }
  const finished = endRow();
  if (finished) yield finished;
}

function getCellValue(
  headers: string[],
  row: string[],
  mapping: CSVColumnMapping,
  field: string,
): string | null {
  const mapVal = mapping[field];
  if (!mapVal) return null;
  if (/^\d+$/.test(mapVal)) {
    const idx = Number.parseInt(mapVal, 10);
    return row[idx] !== undefined ? row[idx] : null;
  }
  const idx = headers.indexOf(mapVal.toLowerCase());
  return idx !== -1 && row[idx] !== undefined ? row[idx] : null;
}

/**
 * Validate a single import row. Shared by the synchronous `processCSVImport`
 * and the streaming `streamCsvImport` so both enforce identical rules.
 */
export function validateImportRow(
  entityType: "lead" | "contact",
  headers: string[],
  row: string[],
  mapping: CSVColumnMapping,
  rowNum: number,
): { record?: Record<string, unknown>; errors: RowValidationError[] } {
  const errors: RowValidationError[] = [];
  const cell = (f: string) => getCellValue(headers, row, mapping, f);

  if (entityType === "lead") {
    const company = cell("company");
    const email = cell("email");
    const status = cell("status") || "New";
    if (!company && !email) {
      errors.push({
        row: rowNum,
        column: "company/email",
        message: "Either Company or Email is required for Leads.",
      });
    }
    if (email && !email.includes("@")) {
      errors.push({
        row: rowNum,
        column: "email",
        message: `Invalid email address format: ${email}`,
      });
    }
    if (errors.length === 0) {
      return {
        record: { company: company || null, email: email || null, status },
        errors,
      };
    }
    return { errors };
  }

  const firstName = cell("firstName");
  const lastName = cell("lastName");
  const email = cell("email");
  if (!lastName) {
    errors.push({
      row: rowNum,
      column: "lastName",
      message: "Last Name is required for Contacts.",
    });
  }
  if (email && !email.includes("@")) {
    errors.push({
      row: rowNum,
      column: "email",
      message: `Invalid email address format: ${email}`,
    });
  }
  if (errors.length === 0) {
    return {
      record: {
        firstName: firstName || "",
        lastName: lastName || "",
        email: email || null,
      },
      errors,
    };
  }
  return { errors };
}

export interface StreamCsvImportResult {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  errors: RowValidationError[];
}

export interface StreamCsvImportOptions {
  /** Flush valid records to the caller every `batchSize` rows (default 1000). */
  batchSize?: number;
  /** Sink for each batch of valid records — wire to a DB COPY/insert here. */
  onBatch?: (rows: Record<string, unknown>[]) => Promise<void> | void;
}

/**
 * Stream-import a CSV: parse + validate row-by-row, flushing valid records in
 * bounded batches so memory stays constant regardless of file size. The first
 * record is treated as the header row.
 */
export async function streamCsvImport(
  source: AsyncIterable<string>,
  entityType: "lead" | "contact",
  mapping: CSVColumnMapping,
  options: StreamCsvImportOptions = {},
): Promise<StreamCsvImportResult> {
  const batchSize = options.batchSize ?? 1000;
  const errors: RowValidationError[] = [];
  let headers: string[] | null = null;
  let totalRows = 0;
  let validRows = 0;
  let dataRowIndex = 0;
  let batch: Record<string, unknown>[] = [];

  const flush = async () => {
    if (batch.length > 0 && options.onBatch) await options.onBatch(batch);
    batch = [];
  };

  for await (const row of streamCsvRows(source)) {
    if (headers === null) {
      headers = row.map((h) => h.toLowerCase());
      continue;
    }
    dataRowIndex++;
    totalRows++;
    const { record, errors: rowErrors } = validateImportRow(
      entityType,
      headers,
      row,
      mapping,
      dataRowIndex + 1,
    );
    if (rowErrors.length > 0) {
      errors.push(...rowErrors);
    } else if (record) {
      validRows++;
      batch.push(record);
      if (batch.length >= batchSize) await flush();
    }
  }
  await flush();

  return { totalRows, validRows, invalidRows: totalRows - validRows, errors };
}
