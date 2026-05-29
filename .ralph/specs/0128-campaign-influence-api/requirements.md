# Spec 0128: Campaign Influence API Requirements

## 1. Functional Requirements

### Campaign Influence Attribution
- Users must be able to associate one or more campaigns with an opportunity.
- Each association must record the campaign, opportunity, and an `influencePercentage` (integer from 0 to 100).
- The system must calculate a campaign's `revenueShare` based on the opportunity `amount` and the campaign's `influencePercentage`.
  - For example, if an opportunity's amount is `"10000.00"` and a campaign has `50%` influence, the campaign's revenue share is `"5000.00"`.
- If the campaign influence is updated/added, the system must validate that the total percentage allocated to all campaigns for that specific opportunity does not exceed 100%.

### Marketing Attribution Dashboard (Campaign ROI)
- Users must be able to query a campaign's total attributed revenue.
- Total campaign revenue attribution must only count influence records associated with opportunities in the `"Closed Won"` stage.
- The return value must aggregate all revenue shares across all Closed Won opportunities for that campaign.

### Audit Trails & Webhooks
- Creating or removing a campaign influence record must create a corresponding `audit_logs` record.
- Creating a campaign influence record must trigger the `opportunity.campaign_influence.created` webhook event.
- Deleting a campaign influence record must trigger the `opportunity.campaign_influence.deleted` webhook event.

## 2. Technical & Non-Functional Requirements

### Row-Level Security (RLS) & Multi-Tenancy
- Every database query and mutation on campaign influence must run within the active tenant context (`app.current_org_id` / `AsyncLocalStorage`).
- A user of Tenant A must never be able to view, create, or delete campaign influence records belonging to Tenant B.
- RLS validation must throw an error if the context org ID is missing or mismatched.

### Code Constraints & Performance
- Pure attribution arithmetic and validation must reside in `packages/core` with 100% unit test coverage.
- Endpoints must be defined in Hono (`apps/api/src/index.ts`) under the strict `/api` prefix and tenantAuth middleware wrapper.
- All files must be typecheck-safe, pass Biome linting, and pass the test suites with zero errors.
