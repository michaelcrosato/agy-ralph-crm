import { processCSVImport, streamCsvImport, streamCsvRows } from "@crm/core";
import { describe, expect, it } from "vitest";

// Emit a string in small chunks to exercise cross-chunk-boundary parsing.
async function* chunked(text: string, size = 7): AsyncGenerator<string> {
  for (let i = 0; i < text.length; i += size) yield text.slice(i, i + size);
}

async function collect<T>(source: AsyncIterable<T>): Promise<T[]> {
  const out: T[] = [];
  for await (const item of source) out.push(item);
  return out;
}

describe("Spec 037: streaming CSV import", () => {
  it("parses quoted fields with commas across chunk boundaries", async () => {
    const csv = `Company Name,Email,Status
"Acme, Inc.",acme@test.com,New
"Globe Corp",globe@test.com,Working`;
    const rows = await collect(streamCsvRows(chunked(csv, 5)));
    expect(rows).toEqual([
      ["Company Name", "Email", "Status"],
      ["Acme, Inc.", "acme@test.com", "New"],
      ["Globe Corp", "globe@test.com", "Working"],
    ]);
  });

  it("handles embedded newlines inside quoted fields", async () => {
    const csv = `note,owner
"line one
line two",alice`;
    const rows = await collect(streamCsvRows(chunked(csv, 4)));
    expect(rows).toEqual([
      ["note", "owner"],
      ["line one\nline two", "alice"],
    ]);
  });

  it("skips blank/whitespace lines like the buffered parser", async () => {
    const csv = "a,b\n\n   \nc,d\n";
    const rows = await collect(streamCsvRows(chunked(csv, 3)));
    expect(rows).toEqual([
      ["a", "b"],
      ["c", "d"],
    ]);
  });

  it("flushes valid records in bounded batches (back-pressure, constant memory)", async () => {
    const lines = ["Company,Email,Status"];
    for (let i = 0; i < 2500; i++) lines.push(`Co${i},u${i}@x.com,New`);
    const csv = lines.join("\n");

    const batchSizes: number[] = [];
    const res = await streamCsvImport(
      chunked(csv, 64),
      "lead",
      { company: "Company", email: "Email", status: "Status" },
      { batchSize: 1000, onBatch: (rows) => void batchSizes.push(rows.length) },
    );

    expect(res.totalRows).toBe(2500);
    expect(res.validRows).toBe(2500);
    expect(res.invalidRows).toBe(0);
    expect(batchSizes).toEqual([1000, 1000, 500]);
  });

  it("reports the same valid/error split as buffered processCSVImport", async () => {
    const csv = `Company,Email Address,Status
Acme Corp,acme@test.com,New
,,Working
Acme Corp,invalid-email,Working`;
    const mapping = {
      company: "Company",
      email: "Email Address",
      status: "Status",
    };

    const collected: Record<string, unknown>[] = [];
    const streamed = await streamCsvImport(chunked(csv, 9), "lead", mapping, {
      onBatch: (rows) => void collected.push(...rows),
    });
    const buffered = processCSVImport(
      "lead",
      csv.split("\n").map((line) => line.split(",")),
      mapping,
    );

    expect(streamed.validRows).toBe(buffered.valid.length);
    expect(collected.length).toBe(buffered.valid.length);
    expect(streamed.errors.map((e) => [e.row, e.column])).toEqual(
      buffered.errors.map((e) => [e.row, e.column]),
    );
  });
});
