# Specification: Marketing Sequence Domain Throttling & Recipient Frequency Capping - Requirements

## 1. Functional Requirements

### 1.1 Throttling & Capping Configuration
- The system MUST support configuring domain throttling and recipient frequency capping.
- We will define a dedicated table `marketing_sequence_caps` containing:
  - `id`: UUID (Primary Key)
  - `orgId`: UUID (Tenant ID reference)
  - `domainThrottleLimit`: Integer (Max emails sent to a single domain in 24 hours, defaults to 5, must be positive).
  - `recipientFrequencyCap`: Integer (Max emails sent to a single recipient in 7 days, defaults to 3, must be positive).
- Strict Row-Level Security (RLS) MUST isolate these settings so each organization can configure its own limits.

### 1.2 Execution Check and Deferral Loop
- During the `executePendingSequenceSteps` loop, before sending the email for a membership:
  - Resolve the recipient's email address and extract the domain name (case-insensitive, e.g., `user@ACME.com` -> `acme.com`).
  - Calculate `domainSentCount`: Count all email activities in the database sent by this tenant organization to any email address ending in `@domain.com` (or `@DOMAIN.com`) in the last 24 hours relative to `currentTime`.
  - Calculate `recipientSentCount`: Count all email activities in the database sent by this tenant organization to this specific recipient (Lead or Contact) in the last 7 days relative to `currentTime`.
  - Fetch the tenant's configuration in `marketing_sequence_caps`. If none exists, default to:
    - `domainThrottleLimit` = 5
    - `recipientFrequencyCap` = 3
  - Enforce Domain Throttling:
    - If `domainSentCount >= domainThrottleLimit`, bypass step execution for this membership.
    - Set the membership's `nextExecutionAt` to exactly 24 hours after the `currentTime`.
    - Log an audit trail entry with:
      - `recordId` = membership ID
      - `recordType` = `"marketing_sequence_memberships"`
      - `action` = `"deferred_domain_throttle"`
      - `changes` = Include domain name, current domain sent count, and limit.
  - Enforce Recipient Frequency Capping:
    - If `recipientSentCount >= recipientFrequencyCap`, bypass step execution for this membership.
    - Set the membership's `nextExecutionAt` to exactly 24 hours after the `currentTime`.
    - Log an audit trail entry with:
      - `recordId` = membership ID
      - `recordType` = `"marketing_sequence_memberships"`
      - `action` = `"deferred_frequency_cap"`
      - `changes` = Include recipient email, current recipient sent count, and limit.

### 1.3 REST API Endpoints
- The system MUST expose:
  - `GET /api/sequences/settings/caps` - Fetch active tenant capping and throttling rules.
  - `POST /api/sequences/settings/caps` - Create or update active tenant capping and throttling rules.
- Validate payload:
  - `domainThrottleLimit` must be a positive integer.
  - `recipientFrequencyCap` must be a positive integer.
  - Return `400 Bad Request` on validation failure.

## 2. Security & RLS Requirements
- A tenant organization MUST NOT be able to view, modify, or trigger throttling evaluations for sequence caps or email activities belonging to another organization.
- Tenancy MUST be resolved from the active session context (`AsyncLocalStorage`).
