# Specification: Marketing Sequence Link Click Triggers - Implementation Plan

## Step 1: Database and Schema Setup
- Add `marketingSequenceLinkActions` table to `packages/db/src/schema.ts` and export it.
- In `packages/db/src/index.ts`:
  - Define interfaces for link actions: `DBMarketingSequenceLinkAction` and `CoreSequenceLinkAction`.
  - Add `marketingSequenceLinkActions` to mock `store`.
  - Add query methods for `marketingSequenceLinkActions` (e.g. `findForStep`, `findOne`, `insert`, `delete`) mimicking RLS rules.

## Step 2: Core Processor Engine
- In `packages/core/src/index.ts`:
  - Export interface `CoreSequenceLinkAction`.
  - Implement and export `processSequenceLinkClick(dbStore, orgId, activityId, clickedUrl, currentTime)`.
  - Wire up matching and action execution (field update and task creation).

## Step 3: REST API Endpoints
- In `apps/api/src/index.ts`:
  - Add routes:
    - `GET /api/sequences/steps/:stepId/link-actions`
    - `POST /api/sequences/steps/:stepId/link-actions`
    - `DELETE /api/sequences/steps/link-actions/:id`
  - Update `GET /api/public/emails/track/click/:token` to invoke `processSequenceLinkClick` in core context.

## Step 4: Integration and RLS Tests
- Create `packages/testing/src/marketing-sequence-link-triggers.test.ts`.
- Write thorough tests asserting:
  - Link actions can be configured via API.
  - Clicks on sequence emails correctly fire configured link click actions.
  - Field updates are correctly persisted on the Lead or Contact.
  - CRM Tasks are correctly generated and linked.
  - Strict tenant RLS isolation enforces that Tenant A cannot see or trigger actions on Tenant B's data.

## Step 5: Verification Gate
- Run `pnpm verify` to check type safety and formatting.
- Run `pnpm test` to verify all Vitest runs pass perfectly.
