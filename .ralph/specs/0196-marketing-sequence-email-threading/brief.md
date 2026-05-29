# Specification: Marketing Sequence Email Threading - Brief

## 1. Functional Objective
To improve sales response rates and maintain realistic communication flows, enterprise marketing sequences and drip campaigns require support for **email threading**.
This feature introduces **Task 0196: Marketing Sequence Email Threading (Reply-to-Previous Step)**.
It enables a sequence step to be configured to send as a "reply" to a previous step in the same sequence. 

When a step is configured as a reply step:
1. It specifies a target `replyToStepNumber` representing a previous step in the sequence.
2. When the step executes for a membership, the engine resolves the email activity created by the previous step for that specific recipient.
3. If a previous activity is found, the engine:
   - Sets the subject of the new email activity to `"Re: " + parentActivity.subject` (if it does not already start with `"Re: "`).
   - Thread-links the new activity by setting `custom.parent_activity_id` to the parent activity's ID in the new activity's custom attributes.

## 2. Technical Scope
- **Database Schema Upgrades**:
  - Add `replyToStepNumber` (integer, optional) to `marketingSequenceSteps` table in `packages/db/src/schema.ts` and `packages/db/src/index.ts`.
- **Core Worker Engine Upgrades**:
  - Update `executePendingSequenceSteps` inside `packages/core/src/index.ts` to check if a step has a `replyToStepNumber` configured.
  - If configured, fetch all activities created for the recipient record (Lead or Contact) by previous steps in this membership's sequence to find the one matching the target step number.
  - Apply the thread styling: prefix the subject with `"Re: "` and inject `parent_activity_id` into the `custom` JSONB properties of the newly created activity.
- **API and REST Gateways**:
  - Update sequence step validation inside `apps/api/src/index.ts` to accept and validate the new `replyToStepNumber` field. Ensure that the target step actually exists in the sequence and has a step number smaller than the current step.
- **Verification and RLS Tests**:
  - Write robust integration and RLS tests in `packages/testing/src/marketing-sequence-threading.test.ts`.
