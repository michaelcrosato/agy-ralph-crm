# Task 002: Campaign UTM Engagement Tracking API

## 1. Description
Extend the CRM campaigns core API to support tracking UTM campaign link tags, enabling sequence link analysis engines to report granular ROI metrics across various advertising channels.

## 2. Acceptance Criteria (DoD)
- [ ] Add `utmSource`, `utmMedium`, and `utmCampaign` fields to `campaigns` table in `packages/db/src/schema.ts`.
- [ ] Update Hono REST routers inside `apps/api/src/index.ts` to support incoming UTM link engagement webhooks.
- [ ] Implement analytics compilation functions reporting performance splits by UTM parameters.
- [ ] Add rigorous integration tests in `packages/testing/src/campaign-email-tracking.test.ts`.

## 3. Implementation Approach
- Update Drizzle schemas and mock database interfaces.
- Capture query parameters inside the webhook trackers and write back to mock DB.

## 4. Technical Specifications
- **Effort**: 1 session (Medium)
- **Dependencies**: TASK001.
- **Likely Files**:
  - `packages/db/src/schema.ts`
  - `apps/api/src/index.ts`
  - `packages/testing/src/campaign-email-tracking.test.ts`

## 5. Out of Scope
- Direct integrations with Google Analytics or external commercial systems.
