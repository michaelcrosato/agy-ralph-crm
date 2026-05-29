# Specification: Marketing Sequence Domain Throttling & Recipient Frequency Capping - Brief

## 1. Functional Objective
To protect domain sending reputation and avoid spamming recipients, enterprise marketing platforms must enforce sending constraints. This feature introduces **Task 0194: Marketing Sequence Domain Throttling & Recipient Frequency Capping**.
It adds two primary mechanisms:
1. **Domain Throttling**: Restricts the maximum number of sequence emails sent to the same email domain (e.g. `acme.com`, `gmail.com`) within a rolling 24-hour window (default limit: 5 emails per domain per day).
2. **Recipient Frequency Capping**: Restricts the maximum number of sequence emails a single recipient (Lead or Contact) can receive within a rolling 7-day window (default limit: 3 emails per recipient per week).

When a sequence membership is evaluated during the execution loop, if domain or recipient limits are exceeded, the execution is deferred (by setting `nextExecutionAt` to 24 hours in the future) and a system audit trail log entry is inserted.

## 2. Technical Scope
- **Database Schema Additions**:
  - Add `marketing_sequence_settings` or upgrade `marketing_sequences` or add a dedicated `marketing_sequence_throttles` configuration table to manage limits.
  - For simplicity and high modularity, we will store tenant-wide default throttling settings in `organizations` or a dedicated `marketing_sequence_caps` table, or add `domainThrottleLimit` (default 5) and `recipientFrequencyCap` (default 3) directly to the sequence configuration or as a new database store `marketingSequenceCaps`. Let's create a dedicated table `marketing_sequence_caps` under `packages/db`.
- **Core Execution Engine Upgrades**:
  - Update `executePendingSequenceSteps` loop in `packages/core` to evaluate domain throttling and recipient frequency capping before sending a step's email.
  - Extract the domain from the recipient's email address (e.g., `user@domain.com` -> `domain.com`).
  - Count the number of sequence emails sent to this domain in the past 24 hours.
  - Count the number of sequence emails sent to this specific recipient (Lead or Contact) in the past 7 days.
  - If either count meets or exceeds the limit, defer the execution:
    - Update `nextExecutionAt` to `currentTime + 24 hours`.
    - Create an audit log indicating the deferral reason ("domain_throttle_breached" or "recipient_frequency_cap_breached").
- **API and REST Gateways**:
  - Add REST endpoints in `apps/api` to query and update the throttling/capping configuration.
- **Verification and RLS Tests**:
  - Write robust integration and RLS tests in `packages/testing/src/marketing-sequence-throttling.test.ts`.
