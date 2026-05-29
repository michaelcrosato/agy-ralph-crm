# Specification: Campaign Unsubscribe & Recipient Opt-Out API - Brief

## 1. Functional Objective
This feature introduces a public Campaign Unsubscribe & Recipient Opt-Out mechanism. It provides an automated, secure, and compliant way for recipients of outbound emails (such as campaign blasts, logged emails, etc.) to unsubscribe from email communications.
It implements:
1. A public unsubscribe endpoint: `GET /api/public/emails/unsubscribe/:token` which looks up the associated outbound email activity, identifies the recipient(s) (Lead or Contact), and updates their GDPR communication consent preference to `opt_out` for the `email` channel.
2. Automatic RLS context propagation to ensure public unsubscriptions are safely attributed and processed under the correct tenant organization context, preventing cross-tenant data exposure.
3. Verification with comprehensive integration tests confirming the end-to-end unsubscription flow, RLS boundaries, and correct audit logs recording.

## 2. Technical Scope
- **Public Endpoint**:
  - `GET /api/public/emails/unsubscribe/:token` - Bypasses standard user auth, looks up the tracker by `token`, resolves the tenant org context, identifies recipients via `activity_links`, and records their opt-out in `contact_consent_preferences`.
- **Relational Domain**:
  - Reuse the existing `contact_consent_preferences` schema in `packages/db` and the consent evaluation engine in `packages/core`.
- **Verification Gate**:
  - Integration tests in `packages/testing/src/campaign-unsubscribe.test.ts` validating the public route, database updates, correct content types, and strict tenant boundary validation.
