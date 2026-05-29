# Specification: Public Web-to-Lead Capture API - Implementation Plan

## 1. Core Routing Integration
- Expose the public, unauthenticated route `POST /api/public/web-to-lead` in `apps/api/src/index.ts` BEFORE the authenticated routes.
- Validate that the `orgId`, `lastName`, and `email` are provided in the payload.
- Verify organization existence and status safely.
- Execute within the tenant RLS block using `withTenant(orgId, mockDb, async () => { ... })`.

## 2. Validation & Metadata Check
- If custom metadata properties are submitted, query defined custom field schemas for "leads".
- Validate custom fields using `validateCustomFields`. Return `400 Bad Request` if validations fail.

## 3. Lead Assignment Routing
- Resolve the lead owner using active Lead Assignment Rules.
- If round-robin matches, update `lastAssignedIndex` on the matched entry.
- Fallback owner resolution when no rules match (assign to provided owner if valid, or first user in org).

## 4. Record Insertion, Auditing & Webhook Execution
- Insert the new lead using `dbStore.leads.insert(...)`.
- Log the creation event in the `audit_logs` table.
- Asynchronously dispatch the outbound webhook notification for the `lead.created` event.

## 5. Testing & Verification
- Scaffold `packages/testing/src/web-to-lead.test.ts`.
- Run complete test suite via `pnpm verify` to confirm workspace compiles cleanly and all tests pass.
