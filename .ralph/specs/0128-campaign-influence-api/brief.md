# Spec 0128: Campaign Influence API Brief

## Objective
Introduce marketing attribution and Campaign Influence modeling to the CRM Core. An Opportunity in an enterprise CRM is frequently influenced by multiple campaigns (e.g., a webinar, a direct email, and a trade show conference). 
This feature enables marketing and sales teams to associate multiple campaigns with a single opportunity, allocate influence percentages (summing up to 100%), and calculate the actual revenue share attributed to each campaign.
This capability operates under strict multi-tenant Row-Level Security (RLS) isolation.

## Scope
* **Core Business Logic**: Implement campaign influence attribution model calculations in `packages/core`. This includes:
  - Validating influence splits (ensuring total percentage equals 100%).
  - Calculating exact revenue share for each campaign based on the opportunity amount.
* **Database & Store Actions**: Update `packages/db` to define the `campaignInfluence` schema and store, enforcing active tenant RLS isolation and providing standard CRUD operations.
* **REST API Endpoints**:
  - `GET /api/opportunities/:id/campaign-influence`: Query all campaign influence records for a specific opportunity.
  - `POST /api/opportunities/:id/campaign-influence`: Define a campaign influence record (campaign, opportunity, percentage).
  - `DELETE /api/opportunities/:id/campaign-influence/:influenceId`: Remove a campaign influence record.
  - `GET /api/campaigns/:id/attribution`: Retrieve the total revenue share attributed to a campaign across all closed-won opportunities.
* **Audit Trail & Webhooks**: Log detailed audit trail entries tracking creation and deletion of campaign influence records, and trigger appropriate outbound webhook events (`opportunity.campaign_influence.created`, `opportunity.campaign_influence.deleted`).
* **Row-Level Security**: Guarantee complete tenant isolation, preventing cross-tenant leakage.
