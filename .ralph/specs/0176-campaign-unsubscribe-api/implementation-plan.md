# Specification: Campaign Unsubscribe & Recipient Opt-Out API - Implementation Plan

## 1. Code Generation Sequence

### 1.1 API Router Layer updates
- Add public route `/api/public/emails/unsubscribe/:token` handler directly in [apps/api/src/index.ts](file:///C:/dev/agy-ralph-crm/apps/api/src/index.ts).
- Mirror other public tracking routes, ensuring that:
  - Token lookup is handled safely without standard user-session authorization.
  - Context is correctly bound via `withTenant(tracker.orgId, mockDb, async () => { ... })`.
  - Recipient targets are resolved from `activityLinks` store.
  - Consents are created/updated in `contactConsentPreferences` store.
  - Audit logs are captured for each resolved recipient.
  - Stylized HTML is served with appropriate Content-Type header.

## 2. Testing Setup

### 2.1 Integration Test creation
- Create the test file [packages/testing/src/campaign-unsubscribe.test.ts](file:///C:/dev/agy-ralph-crm/packages/testing/src/campaign-unsubscribe.test.ts).
- Include comprehensive verification scenarios:
  1. Success scenario:
     - Log email to contact, create tracker token.
     - Call public unsubscribe with valid token.
     - Verify HTML response status (200) and headers.
     - Assert that the contact's consent is now `opt_out` in the db store.
     - Assert that audit log is created correctly.
  2. Missing token scenario:
     - Call unsubscribe with invalid token.
     - Verify 404 response.
  3. Multi-Tenant isolation scenario:
     - Try calling unsubscribe under Tenant B context or assert that the opt-out is recorded strictly within Tenant A's boundaries.
