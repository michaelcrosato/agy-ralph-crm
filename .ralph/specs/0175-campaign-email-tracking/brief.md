# Specification: Campaign Email Open & Click Tracking API - Brief

## 1. Functional Objective
This feature introduces an Outbound Email Open & Click Tracking system. It allows marketing and sales teams to automatically track when recipients open emails sent from the CRM (such as campaign blasts, direct emails, etc.) or click on links contained within those emails.
It provides:
1. Public tracking endpoints to record email open events via a 1x1 transparent pixel and link click events via redirect URLs.
2. Analytics tracking store mapping events back to specific outbound activities.
3. Secure, tenant-isolated REST APIs for managers to query tracking metrics.

## 2. Technical Scope
- **Tenancy Isolation**: Public tracking pixel/redirect endpoints must resolve the campaign/email tracker safely without throwing raw RLS context errors since these are external events, but must correctly attribute them to the correct tenant. All authenticated query endpoints must strictly enforce active tenant org row-level security (RLS) constraints.
- **REST Endpoints**:
  - `GET /api/public/emails/track/open/:token` - Record an open event via a transparent pixel (returns a 1x1 image).
  - `GET /api/public/emails/track/click/:token` - Record a link click event and redirect the client to the destination target.
  - `POST /api/emails/:activityId/tracker` - Create a tracking configuration for a given email activity (generates a unique token).
  - `GET /api/emails/:activityId/tracker` - Fetch tracking metrics for a given email activity.
- **Verification**: Thorough RLS and integration tests validating open recording, click recording, correct redirection, and robust multi-tenant security boundary validation.
