# Specification: Marketing Sequence Member Snooze & Resume Engine - Implementation Plan

## 1. File Modification Sequence

### Step 1: Database Schema Modifications
- Update `packages/db/src/schema.ts` to add `snoozeUntil` and `snoozeReason` to `marketingSequenceMemberships`.
- Update `DBMarketingSequenceMembership` interface in `packages/db/src/index.ts` to include these fields.
- Update `packages/db/src/index.ts` mock store implementation so that `insert` and `update` correctly map these new columns and that `insert` defaults them to `null`.

### Step 2: Core Domain Logic Upgrades
- Update `CoreSequenceMembership` interface in `packages/core/src/index.ts`.
- Edit `executePendingSequenceSteps` in `packages/core/src/index.ts` to run the automatic resumption checks at the start of execution.
- Assert that only `"active"` memberships are selected for step execution.

### Step 3: REST Router Additions
- Open `apps/api/src/index.ts`.
- Append the `POST /api/sequences/memberships/:membershipId/snooze` and `POST /api/sequences/memberships/:membershipId/resume` route handlers.
- Handle active organization tenant isolation (RLS validation) by querying `findOne` and rejecting unauthorized cross-tenant requests.

### Step 4: Write Integration & RLS Tests
- Create `packages/testing/src/marketing-sequence-snooze.test.ts`.
- Assert manual snoozing & audit logs.
- Assert manual resuming & audit logs.
- Assert background auto-resumption & step execution.
- Assert strict cross-tenant RLS boundaries (Tenant B must not be able to snooze/resume Tenant A's memberships).

---

## 2. Verification Gates

Execute verification commands in the workspace root:
- Format and Lint: `npx biome check --write .`
- Type safety: `pnpm typecheck`
- Integration tests: `pnpm --filter @crm/testing test marketing-sequence-snooze.test.ts`
- Global compile verification: `pnpm verify`
