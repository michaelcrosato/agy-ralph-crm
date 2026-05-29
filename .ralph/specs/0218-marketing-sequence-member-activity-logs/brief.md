# Specification: Marketing Sequence Member Activity Logs & Timeline API - Brief

## 1. Functional Objective
This feature introduces unified recipient-level activity logs and chronological engagement timelines to the Marketing Automation module (Task 0218). In an enterprise-grade CRM, sales and marketing teams must be able to view every single interaction a specific contact or lead has had within a marketing sequence in a consolidated chronological stream.

When querying the activity logs for a sequence membership, the system must:
1. **Consolidate multiple event streams**: Fetch and aggregate sent emails, opens (`emailOpenEvents`), clicks (`emailClickEvents`), replies (`emailReplyEvents`), bounces/complaints (`emailBounceEvents`), and read time events (`emailReadTimeEvents`) associated with the recipient's tracker tokens.
2. **Compile a chronological timeline**: Sort all events by timestamp in descending order, returning a unified stream of activity entries with detailed metadata (e.g. clicked URLs, sentiment of replies, device type of opens, read time classifications).
3. **Assert strict active tenant Row-Level Security (RLS)**: Enforce complete organization boundary isolation. Mismatched tenant org IDs must trigger database-level context checks and throw RLS isolation errors.

## 2. Technical Scope
- **Tenancy Isolation**: All memberships, trackers, and event logs must be queried under strict tenant context checks.
- **Pure Core Logic**: Core method `getMarketingSequenceMemberLogs(dbStore, sequenceId, memberId, orgId)` in `packages/core/src/index.ts` will fetch the membership record, verify the tenant match, identify all related email trackers, query all matching events, and compile them into a sorted timeline.
- **REST Endpoints**:
  - `GET /api/sequences/:id/members/:memberId/logs` - Retrieves the chronological activity logs and engagement timeline for a specific sequence membership.
- **Verification**: Complete integration test coverage validating tenant RLS, correct event consolidation, pro-active validation errors, and API contract compliance.
