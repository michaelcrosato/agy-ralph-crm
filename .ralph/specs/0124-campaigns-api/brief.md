# Spec 0124: Campaigns & Campaign Members API Brief

## Objective
Enable marketing campaign tracking, campaign member management (associating Leads and Contacts with Campaigns), and closed-loop ROI reporting within the CRM core. This feature will allow organizations to measure campaign effectiveness, track status transitions for members, and attribute closed-won opportunities back to marketing campaigns under active tenant RLS isolation.

## Scope
* **Database Schema Expansion**: Create `campaigns` and `campaign_members` tables. Add `campaign_id` tracking to the `opportunities` table.
* **Core Business Logic**: Implement a helper to calculate campaign metrics, including response rates, conversion counts, budgeted vs. actual costs, and revenue ROI (from Closed Won opportunities).
* **REST API Endpoints**: Expose tenant-isolated API routes for creating, listing, updating campaigns, registering campaign members (Leads/Contacts), and fetching campaign metrics.
* **Row-Level Security**: Ensure complete tenant isolation such that tenants can only view/mutate their own campaigns, campaign members, and attributed opportunities.
