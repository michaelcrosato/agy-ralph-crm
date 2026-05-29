# Task 0164: CSV Data Import Wizard & Column Mapping Engine - Requirements

## Functional Requirements

1. **CSV Parsing Engine**:
   - Parse a standard comma-separated value (CSV) string.
   - Correctly parse headers and standard quote/escape sequences.
   - Support arbitrary column orders and empty columns.

2. **Dynamic Column Mapping**:
   - Accept a mapping definition that maps CSV headers (or column indices) to standard entity fields (e.g. `company`, `email`, `status` for Leads; `firstName`, `lastName`, `email` for Contacts).
   - Gracefully handle unmapped columns by ignoring them.

3. **Dry-Run Validation Mode**:
   - Accept a `dryRun: boolean` parameter.
   - Validate each mapped row against entity constraints:
     - `email` must be a valid email format (if provided).
     - Required fields must be present (e.g. `company` or `email` for Leads, `lastName` for Contacts).
     - Standard field constraints like status picklists.
   - Return a response showing:
     - `totalRows`: Number of parsed rows.
     - `validRows`: Number of rows that passed validation.
     - `invalidRows`: Number of rows that failed validation.
     - `errors`: Array of `{ row: number, column: string, message: string }` indicating exact validation failures.

4. **Multi-Tenant RLS Enforcement**:
   - Must run under the active tenant context using standard Drizzle ORM store operations wrapped in `withTenant` or `dbStore` contexts.
   - Ensure created records automatically populate `orgId` matching the active tenant.
   - Block cross-tenant access during validation and insertion processes.

5. **Insert Execution Mode**:
   - When `dryRun: false`, perform insertion of all valid rows.
   - Execute in a single database transaction or batch insertion block under the tenant.
   - Return a success status with counts of created records and any failed row details.
