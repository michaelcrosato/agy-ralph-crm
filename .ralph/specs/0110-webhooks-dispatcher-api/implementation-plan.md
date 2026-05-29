# Specification: Multi-Tenant Outbound REST Webhooks Dispatcher - Implementation Plan

## Development Sequence

### Step 1: Database Additions
- Extend `packages/db/src/schema.ts` with `webhookDeliveries`.
- Extend `packages/db/src/index.ts` with mock database arrays and dbStore methods for `webhooks` and `webhookDeliveries`.

### Step 2: Create packages/webhooks Workspace Package
- Create workspace package `packages/webhooks/package.json` and `packages/webhooks/tsconfig.json`.
- Implement `packages/webhooks/src/index.ts` with hmac signature generation and simulated webhook postings.

### Step 3: REST Routes Integration
- Add Hono routes for subscriptions under `/api/webhooks` in `apps/api/src/index.ts`.
- Integrate triggers in lead creations, lead conversions, opportunity stage patches, and ticketing completions to automatically fire webhooks.

### Step 4: Verification Unit & Integration Tests
- Create `packages/testing/src/webhooks.test.ts` validating correct event subscriptions, delivery outcome logging, custom headers signing, and RLS tenant barriers.
