# Spec 0125: Opportunity Stage History & Velocity Tracking API Brief

## Objective
Enable automatic auditing and velocity tracking for Opportunity Stages inside the CRM Core. As opportunities progress from Prospecting through Closed Won/Lost, it is business-critical to record exactly when stage transitions occur, how long opportunities spend in each stage (stage velocity), who performed the transition, and the historical deal amounts. This provides data for sales funnel reporting, performance analysis, and deal velocity optimization under active tenant RLS isolation.

## Scope
* **Database Schema Expansion**: Create an `opportunity_stage_history` table to record stage transitions, including old stage, new stage, opportunity amount, and the user who triggered the stage change.
* **Core Business Logic**: Implement a pure utility function to compute average time-in-stage (velocity analysis) for a collection of history entries.
* **Auto-Tracking Trigger**: Ensure that any mutation changing an opportunity stage (via the REST API or workflows) automatically inserts a record into the stage history table.
* **REST API Endpoints**: Expose isolated endpoints to query stage history logs for a specific opportunity and retrieve aggregated stage velocity reports (average hours/days spent in each stage).
* **Row-Level Security**: Guarantee complete tenant isolation, preventing any tenant from accessing or mutating stage history entries of another organization.
