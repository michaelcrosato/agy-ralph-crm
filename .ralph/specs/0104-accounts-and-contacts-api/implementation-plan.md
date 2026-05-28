# Specification: Accounts & Contacts REST API - Implementation Plan

## Code Generation Sequence

### Step 1: REST Accounts & Contacts Routes
Implement read operations endpoints inside `apps/api/src/index.ts`:
- `GET /api/accounts`
- `GET /api/accounts/:id`
- `GET /api/contacts`
- `GET /api/contacts/:id`

### Step 2: Verification Testing
Create `packages/testing/src/accounts-contacts-api.test.ts` to assert that listing and retrieving Accounts and Contacts adhere to tenant limits, preventing cross-tenant information leakage.
