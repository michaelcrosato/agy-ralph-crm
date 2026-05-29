# Spec 0137: Opportunity Competitors API Brief

## Objective
Enable sales representatives to track and manage competitors associated with each Sales Opportunity. In a competitive sales environment, understanding which competitors are present on a deal, their relative strengths and weaknesses, and the final win/loss outcomes is essential for competitive intelligence, sales strategy, and win-rate analytics. This feature provides a robust, multi-tenant Row-Level Security (RLS) isolated API to link competitors to opportunities, manage their competitive profiles, and track competitive outcomes.

## Scope
* **Core Business Logic**: Implement competitor metrics calculation in `packages/core` (e.g. `calculateOpportunityCompetitorStats` which computes competitor counts and lists key competitors).
* **Database & Store Actions**: Update `packages/db` with a new `opportunity_competitors` schema, store array, and dbStore operations (`findMany`, `findOne`, `insert`, `update`, `delete`) with strict organization-level RLS context checks.
* **REST API Endpoints**:
  - `GET /api/opportunities/:id/competitors`: Retrieve all competitors listed for an opportunity in the active organization.
  - `POST /api/opportunities/:id/competitors`: Add a competitor to an opportunity, specifying name, strengths, weaknesses, win/loss status, and notes.
  - `PUT /api/opportunities/:id/competitors/:competitorId`: Update competitive profile or status of a competitor.
  - `DELETE /api/opportunities/:id/competitors/:competitorId`: Remove a competitor record from an opportunity.
* **Audit Trail & Webhooks**: Create detailed audit log entries tracking the creation, update, and removal of competitors, and trigger a `competitor.updated` outbound webhook event.
* **Row-Level Security**: Ensure complete tenant isolation—preventing Tenant B from viewing or modifying competitors of Tenant A's opportunities.
