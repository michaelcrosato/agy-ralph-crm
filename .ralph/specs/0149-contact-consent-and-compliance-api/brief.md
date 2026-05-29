# Specification: Contact Consent & GDPR Compliance API - Brief

## 1. Functional Objective
To ensure compliance with global data protection regulations (such as GDPR, CCPA, and CASL), enterprise CRM platforms must manage contact communication preferences and verify consent before sending out marketing or operational communications.

This feature introduces the **Contact Consent & GDPR Compliance API**. The system will:
1. Allow tenants to store and update communication preferences (channels: `"email"`, `"sms"`, `"phone"`; status: `"opt_in"`, `"opt_out"`, `"pending"`) for Contacts and Leads.
2. Track a complete history of consent changes including the channel, opt-in/opt-out status, reason/source (e.g. `"web_form"`, `"manual"`, `"api"`), and the user who registered the preference.
3. Provide pure core functions to validate if a Lead or Contact can be contacted on a specific channel.
4. Expose REST endpoints to manage and query communication consent preferences under strict multi-tenant Row-Level Security (RLS) isolation.

## 2. Technical Scope
- **Database Schema**:
  - Add `contact_consent_preferences` to `packages/db/src/schema.ts` and update the in-memory store in `packages/db/src/index.ts`.
- **Core Pure Logic**:
  - Implement `validateCommunicationConsent` in `packages/core/src/index.ts` to evaluate whether a Contact or Lead has active consent for a given channel.
- **REST Endpoints**:
  - `GET /api/consent` - Queries consent preference status for a Contact or Lead by ID.
  - `POST /api/consent` - Creates or updates a preference for a specific Contact or Lead, logging the update source and tracking user.
- **Tenant RLS & Security**:
  - Ensure all queries, upserts, and lookups run strictly within the active tenant's context. A tenant must never see or alter consent preferences belonging to another organization.
- **Verification & Integration Tests**:
  - Write integration tests inside `packages/testing/src/contact-consent.test.ts` validating consent logic correctness, audit trails, and multi-tenant RLS isolation.
