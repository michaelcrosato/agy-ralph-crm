# Spec 0137: Opportunity Competitors API Requirements

## Functional Requirements

### 1. Database Schema & Persistence (`opportunity_competitors`)
* Define the database table `opportunity_competitors` with fields:
  - `id`: Unique identifier (UUID, primary key, auto-generated).
  - `orgId`: Tenant organization reference (UUID, references `organizations.id`, cascade delete, not null).
  - `opportunityId`: Opportunity reference (UUID, references `opportunities.id`, cascade delete, not null).
  - `name`: Competitor name (Text, trimmed, not null).
  - `strength`: Competitor strength profile (Text, optional).
  - `weakness`: Competitor weakness profile (Text, optional).
  - `winLossStatus`: Status of competitive interaction (Text, not null, default "Pending"). Must validate to either "Pending", "Won", or "Lost".
  - `notes`: Additional intelligence notes (Text, optional).
  - `createdAt`: Timestamp (default `now()`, not null).

### 2. Core Calculations (`calculateOpportunityCompetitorStats`)
* Add a pure function `calculateOpportunityCompetitorStats` under `packages/core/src/index.ts`.
* **Input**:
  - `competitors`: An array of competitor records.
* **Output**:
  - `competitorCount`: Total number of competitors.
  - `wonCount`: Number of competitors marked as "Won".
  - `lostCount`: Number of competitors marked as "Lost".
  - `pendingCount`: Number of competitors marked as "Pending".
  - `competitorList`: Array of competitor names.

### 3. REST API Endpoints in `apps/api/src/index.ts`
* All endpoints MUST be secured with the `tenantAuth` middleware to enforce active tenant contexts.
* **GET `/api/opportunities/:id/competitors`**:
  - Retrieve the target opportunity. Return `404 Not Found` if it does not exist or does not belong to the active organization.
  - Query and return all competitors linked to the opportunity.
* **POST `/api/opportunities/:id/competitors`**:
  - Retrieve target opportunity. Return `404` if not found or org mismatch.
  - Validate request body: `name` is required and must not be empty. `winLossStatus` must be either "Pending", "Won", or "Lost" if provided.
  - Save new competitor.
  - Write a `create_competitor` audit log.
  - Trigger a `competitor.created` outbound webhook event.
  - Return the created competitor record with status `201 Created`.
* **PUT `/api/opportunities/:id/competitors/:competitorId`**:
  - Retrieve target opportunity and competitor. Return `404` if either does not exist or does not belong to the active organization.
  - Validate updated fields.
  - Save updates.
  - Write an `update_competitor` audit log.
  - Trigger a `competitor.updated` outbound webhook event.
  - Return the updated competitor record with status `200 OK`.
* **DELETE `/api/opportunities/:id/competitors/:competitorId`**:
  - Retrieve target opportunity and competitor. Return `404` if either does not exist or org mismatch.
  - Delete competitor record from database.
  - Write a `delete_competitor` audit log.
  - Trigger a `competitor.deleted` outbound webhook event.
  - Return status `200 OK` with success indicator.

### 4. Row-Level Security & Tenant Isolation
* Queries and mutations MUST strictly operate within the active tenant organization context.
* A user from Tenant A MUST NEVER be able to query, create, update, or delete competitor records linked to Tenant B's opportunities.
