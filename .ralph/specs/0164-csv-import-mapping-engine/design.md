# Task 0164: CSV Data Import Wizard & Column Mapping Engine - Design

## 1. Type Mappings & Interface Contracts

```typescript
export interface CSVColumnMapping {
  // maps entity field name (e.g. 'company', 'email', 'status', 'firstName', 'lastName')
  // to CSV column header name (e.g. 'Company Name', 'Email Address') or index as string (e.g. '0', '1')
  [entityField: string]: string;
}

export interface CSVImportInput {
  entityType: "lead" | "contact";
  csvContent: string;
  mapping: CSVColumnMapping;
  dryRun: boolean;
}

export interface RowValidationError {
  row: number;
  column: string;
  message: string;
}

export interface CSVValidationResult {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  errors: RowValidationError[];
  importedIds?: string[];
}
```

## 2. API Endpoints

We expose a new POST endpoint `/api/imports/csv` in Hono.

### Request Payload (`POST /api/imports/csv`)
- Authentication: Standard `Bearer [Token]` (tenantAuth middleware enforced).
- Body:
```json
{
  "entityType": "lead",
  "csvContent": "Company Name,Email Address,Status\nAcme Corp,acme@test.com,New\nGlobe Corp,invalid-email,Working",
  "mapping": {
    "company": "Company Name",
    "email": "Email Address",
    "status": "Status"
  },
  "dryRun": true
}
```

### Response Payload (Dry-Run: true)
```json
{
  "success": true,
  "data": {
    "totalRows": 2,
    "validRows": 1,
    "invalidRows": 1,
    "errors": [
      { "row": 2, "column": "email", "message": "Invalid email address format: invalid-email" }
    ]
  }
}
```

### Response Payload (Dry-Run: false)
```json
{
  "success": true,
  "data": {
    "totalRows": 2,
    "validRows": 1,
    "invalidRows": 1,
    "errors": [
      { "row": 2, "column": "email", "message": "Invalid email address format: invalid-email" }
    ],
    "importedIds": ["lead-xyz123"]
  }
}
```

## 3. Database Insertion Logic

- Insertion relies on standard `dbStore.leads.insert` or `dbStore.contacts.insert`.
- Every mutation executes inside the active tenant RLS context provided by `tenantAuth` (which uses `withTenant` underneath).
- All items inserted are automatically verified for active tenant membership.
