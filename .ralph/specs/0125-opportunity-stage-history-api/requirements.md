# Spec 0125: Opportunity Stage History & Velocity Tracking API Requirements

## Functional Requirements

### 1. Stage History Automation
* The system must automatically record a transition entry in the `opportunity_stage_history` table whenever an Opportunity's `stage` is updated.
* Stage transition records must include:
  * `opportunityId`: Reference to the Opportunity being modified.
  * `fromStage`: The previous stage (nullable for initial creation).
  * `toStage`: The new stage.
  * `amount`: The current Opportunity amount at the time of transition (nullable).
  * `changedById`: Reference to the User who made the change.
  * `createdAt`: Timestamp when the change occurred.

### 2. Velocity Tracking & Core Analytics
* The core domain must support a pure function, `calculateStageVelocity`, that processes a series of stage transition records for a set of opportunities and calculates the total and average duration spent in each stage.
* The output metrics should include:
  * Average duration in days (or hours/seconds for granular testability) spent by opportunities in each stage.
  * Count of opportunities that transitioned through each stage.

### 3. REST API Endpoints
* **`GET /api/opportunities/:id/stage-history`**:
  * Retrieve all chronological stage transition records for a specific opportunity.
  * Response must be ordered from oldest to newest transition.
* **`GET /api/reports/stage-velocity`**:
  * Return aggregate analytics showing the average duration (in hours or days) opportunities spend in each stage within the current tenant.

## Row-Level Security (RLS) Requirements
* All queries and insertions in the `opportunity_stage_history` table must be bounded strictly to the active tenant (`orgId`).
* Any cross-tenant read or write access attempts must result in an immediate Database/API authorization rejection.
* If a tenant queries an opportunity's stage history, they must only see records belonging to their own organization.
