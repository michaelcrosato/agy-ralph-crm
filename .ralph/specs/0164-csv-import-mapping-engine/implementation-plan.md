# Task 0164: CSV Data Import Wizard & Column Mapping Engine - Implementation Plan

## 1. Scaffold core utility structures
Update `packages/core/src/index.ts` to include:
- Interfaces: `CSVColumnMapping`, `CSVImportInput`, `RowValidationError`, `CSVValidationResult`
- Pure function `parseCSV(content: string): string[][]` to split CSV content into rows and cells, handling trim, basic quotes.
- Export function `processCSVImport` which accepts the parsed rows, entityType, mappings, active tenant credentials (`orgId`, `userId`), dry-run option, and database transaction/insert handle.

## 2. API Routes Integration
Update `apps/api/src/index.ts` to:
- Add a new REST API endpoint `POST /api/imports/csv` utilizing `tenantAuth`.
- Map incoming fields to `processCSVImport` and respond with the validation/import summary.

## 3. Integration & RLS Isolation Tests
Create `packages/testing/src/csv-import.test.ts` containing:
- CSV parsing unit assertions.
- Dry-run validation testing, asserting that errors are detected and returned with row indices.
- Real execution testing, asserting that records are correctly inserted into the store when dry-run is false.
- Row-Level Security (RLS) validation asserting that cross-tenant insertion is blocked, and queried records are isolated to their owner tenant.

## 4. Verification and Commit
- Run `pnpm verify` to check compilation, formatting, and linting.
- Run `pnpm test` to verify all tests pass.
- Commit to Git: `feat: implement CSV Import Wizard and Column Mapping Engine (task 0164)`
