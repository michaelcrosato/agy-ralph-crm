# Specification: Lead Auto-Conversion Rules & Criteria Engine - Implementation Plan

## 1. Database & Schema Configuration
- Edit `packages/db/src/schema.ts` to add the `leadAutoConversionRules` table definition.
- Edit `packages/db/src/index.ts`:
  - Define the `DBLeadAutoConversionRule` typescript interface.
  - Extend the global `store` type and initial state to include `leadAutoConversionRules: []`.
  - Add standard `findMany`, `findOne`, `insert`, and `update` CRUD handlers for `leadAutoConversionRules` inside `dbStore`. Include strict `getActiveOrgId()` RLS validations.

## 2. Core Business Logic Implementation
- Edit `packages/core/src/index.ts`:
  - Add and export `evaluateLeadAutoConversion` logic supporting score, status, and custom field criteria.

## 3. REST API Endpoint Wiring
- Edit `apps/api/src/index.ts`:
  - Register endpoints:
    - `GET /api/leads/auto-conversion-rules` (enforced via `tenantAuth`)
    - `POST /api/leads/auto-conversion-rules` (enforced via `tenantAuth`)
  - Inside the existing `POST /api/leads` and `PATCH /api/leads/:id` routes (or equivalent), integrate the auto-conversion check.
  - If a rule triggers:
    - Resolve the active lead score using lead scoring rules if applicable, or default to 0.
    - Evaluate criteria.
    - If criteria matches: convert Lead to Account, Contact, and Opportunity using pure `convertLead` or conversion mappings, write records to database, update Lead record to Converted, insert `audit_logs`, and asynchronously fire outbound webhooks for the conversion event.

## 4. Testing & Verification
- Scaffold `packages/testing/src/lead-auto-conversion.test.ts`.
- Write tests verifying:
  - Strict RLS isolation (Tenant A cannot see Tenant B's rules).
  - Rules correctly match and convert when lead criteria are updated.
  - Audit trail matches expectations and outbound webhook triggers.
- Run `pnpm verify` to confirm everything compiles and runs clean.
