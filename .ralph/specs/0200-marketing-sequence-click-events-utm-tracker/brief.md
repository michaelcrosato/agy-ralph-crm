# Specification: Marketing Sequence Email Granular Click Events & UTM Tracking - Brief

## 1. Functional Objective
To enable modern enterprise marketing attribution, tracking, and campaign ROI analysis, this feature introduces **Task 0200: Marketing Sequence Email Granular Click Events & UTM Tracking**.

Currently, the CRM logs the aggregate count of email clicks (`clickCount` and `lastClickedAt`) on the `email_trackers` table but does not record granular, detailed records of individual clicks. Granular event tracking is essential for analyzing customer engagement patterns, validating click sources, and attributing conversions to specific UTM parameters.

With this feature:
1. Every time a recipient clicks a link in a marketing email tracker:
   - The aggregate metrics on the tracker (`clickCount`, `lastClickedAt`) will still increment.
   - A granular `email_click_events` record will be created.
   - The event will capture the clicked URL, the requester's IP address, the user agent, and parsed UTM marketing parameters (`utm_source`, `utm_medium`, `utm_campaign`, `utm_term`, `utm_content`).
2. Enterprise users can fetch a timeline/stream of granular click events for any email tracker under their organization's tenant context.
3. Strict tenant RLS isolation will be enforced: no tenant can query or view click events belonging to another tenant's email trackers.

## 2. Technical Scope
- **Database Schema**:
  - Add `emailClickEvents` (`email_click_events`) table in `schema.ts` and `index.ts` under `packages/db`.
  - Columns: `id`, `orgId` (ref organizations), `trackerId` (ref emailTrackers), `clickedUrl`, `ipAddress`, `userAgent`, `utmSource`, `utmMedium`, `utmCampaign`, `utmTerm`, `utmContent`, `createdAt`.
- **Hono REST endpoints**:
  - Expose `GET /api/emails/trackers/:trackerId/clicks` under tenant RLS context to retrieve granular click events.
  - Update `GET /api/public/emails/track/click/:token` to capture client IP, User Agent, parse UTM params from target URL, insert into `emailClickEvents`, and invoke the existing `processSequenceLinkClick` workflow triggers.
- **Tests**:
  - Write comprehensive RLS and integration tests in `packages/testing/src/marketing-sequence-click-events.test.ts`.
