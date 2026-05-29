# Task 0163: High Scale Seeder and Fuzz Testing Engine - Requirements

## 1. High Scale Seeder
- **Volume**: Must support generating up to 1,000,000 CRM records in memory or virtual chunks without triggering Node.js out-of-memory (OOM) errors.
- **Relational Integrity**: Seeded Accounts, Contacts, Leads, and Opportunities must maintain correct foreign keys and relational links.
- **RLS Tenancy**: All seeded records must belong to the active tenant org context.

## 2. Security & Input Fuzzing
- **Fuzz Generator**: Generate semi-random string, numeric, boolean, and picklist inputs containing boundary values, SQL injection patterns (`' OR 1=1 --`), HTML scripts (`<script>alert(1)</script>`), empty structures, and oversized data payloads.
- **End-to-End Fuzzing**: Automatically invoke Lead, Account, Contact, and Opportunity insertion/conversion routines with fuzzed payloads.
- **Leak Detection**: Ensure no fuzz input triggers a database crash or tenant context leak, throwing an RLS exception if org ID mismatches are detected.

## 3. Administrative REST APIs
- **POST `/api/admin/seed`**: Expose an endpoint that accepts a seed configuration (accounts, contacts, leads, opportunities) and populates the database under the caller's active tenant org context.
- **POST `/api/admin/fuzz`**: Expose an endpoint that triggers a fuzz run on active routes under the caller's tenant context, returning a JSON report of passes, crashes, and leaks.

## 4. Performance Assertions
- **Vitest Suites**: A dedicated Vitest integration suite must execute high-scale seeder operations and assert queries run within the 50ms threshold.
