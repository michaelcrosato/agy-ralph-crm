# Specification: Marketing Sequence Dynamic Sender Assignment - Brief

## 1. Functional Objective
To ensure marketing drip campaigns and sales sequence communications are dynamic and personalized, enterprise CRMs must support assignable sender rules. This feature introduces **Task 0195: Marketing Sequence Dynamic Sender Assignment (Send-as-Owner & Custom Sender Alias)**.
It introduces the ability to configure sequence-level sender policies:
1. **System Default**: Sends from a generic CRM system zero UUID ("00000000-0000-0000-0000-000000000000").
2. **Send as Owner**: Sends from the active owner (`ownerId`) of the targeted Lead or Contact. If no owner is assigned, it falls back to the system default.
3. **Specific Sender**: Sends from a specific, pre-configured user ID in the tenant organization.

When a sequence step executes and creates an email activity, the `creatorId` of the activity is resolved dynamically based on the configured sequence sender policy.

## 2. Technical Scope
- **Database Schema Upgrades**:
  - Add `senderType` (text, default "system") and `senderUserId` (uuid, reference to users) columns to the `marketing_sequences` schema under `packages/db`.
- **Core Worker Engine Upgrades**:
  - Update `executePendingSequenceSteps` inside `packages/core` to resolve the sender user ID based on the sequence configuration before executing step actions.
  - Assert that dynamic Lead or Contact `ownerId` values are extracted and applied cleanly as activity `creatorId` values.
- **API and REST Gateways**:
  - Update `POST /api/sequences` and add a new `PATCH /api/sequences/:id` endpoint inside `apps/api` to accept and validate the new sender configuration fields.
- **Verification and RLS Tests**:
  - Write robust integration and RLS tests in `packages/testing/src/marketing-sequence-sender.test.ts`.
