# Specification: Marketing Sequence Suppression Lists & Exclusion Rules Engine - Brief

## 1. Functional Objective
In enterprise-grade B2B marketing automation, ensuring that communication is compliant, targeted, and safe is of paramount importance. Marketing teams need the ability to prevent specific leads or contacts from receiving communications from marketing sequences. This can happen globally (e.g. competitor email domains like `@competitor.com`, internal employees, or manually suppressed accounts) or sequence-specifically (e.g. suppressing existing customers from a new acquisition sequence).

This feature introduces a **Marketing Sequence Suppression Lists & Exclusion Rules Engine** to the CRM.
Marketing and operations managers can:
1. Manage a global **Suppression List** to prevent contacts or leads from enrolling in or receiving steps from *any* sequence.
2. Define **Exclusion Rules** on a per-sequence basis (e.g., exclude contacts matching a specific email domain, or belonging to a specific segment).

When a record is enrolled or steps are executed, the engine automatically runs checks. If a record is suppressed or excluded:
- During enrollment: The enrollment is blocked, or the membership status is immediately set to `"suppressed"`.
- During step execution: The delivery of the email/action is bypassed, and the membership status is updated to `"suppressed"`, stopping further drip steps.

## 2. Technical Scope
- **Database Schema**:
  - Add `marketing_sequence_suppressions` table under `packages/db/src/schema.ts` for global suppression records.
  - Add `marketing_sequence_exclusions` table under `packages/db/src/schema.ts` for sequence-specific exclusion rules.
- **Core Engine Integration**:
  - Implement a `checkSuppression` and `evaluateExclusions` engine in `packages/core/src/index.ts` to check if a record is suppressed or excluded.
  - Integrate these checks into `enrollInSequence` and the sequence step execution worker (`executePendingSequenceSteps`).
- **REST Endpoints**:
  - `GET /api/sequences/suppressions` - Retrieves all global suppression records.
  - `POST /api/sequences/suppressions` - Manually adds a record (lead/contact) or pattern (email/domain) to the global suppression list.
  - `DELETE /api/sequences/suppressions/:id` - Removes a suppression record.
  - `GET /api/sequences/:id/exclusions` - Retrieves exclusion rules for a sequence.
  - `POST /api/sequences/:id/exclusions` - Creates or updates an exclusion rule for a sequence.
  - `DELETE /api/sequences/:id/exclusions/:exclusionId` - Deletes an exclusion rule.
- **Verification**:
  - Comprehensive integration tests in `packages/testing/src/marketing-sequence-suppressions.test.ts` validating global suppression list checks, domain-based exclusion rules, RLS tenant isolation, and audit trail logs.
