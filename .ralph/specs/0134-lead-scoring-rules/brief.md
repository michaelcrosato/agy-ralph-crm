# Spec 0134: Lead Scoring Rules Brief

## Objective
Introduce a Rule-Based Lead Scoring Engine to the CRM Core. Lead scoring enables sales organizations to automatically grade and prioritize incoming leads based on their profile data (e.g. company size, email domain, matching specific custom field values). This allows sales representatives to prioritize high-value prospects and accelerate the sales cycle.

This feature enables tenants to define custom, rule-based scoring parameters via Criteria Conditions, implements a core lead scoring evaluation utility in `packages/core`, exposes REST API endpoints for managing scoring rules and calculating/recalculating a lead's score, and ensures strict Row-Level Security (RLS) isolation and comprehensive audit trail logging.

## Scope
* **Database & Store Actions (`packages/db`)**:
  - Add the `lead_scoring_rules` table to the database schema in `packages/db/src/schema.ts`.
  - Expose helper store methods to perform CRUD operations on lead scoring rules under active tenant RLS isolation.
* **Core Business Logic (`packages/core`)**:
  - Implement a `calculateLeadScore` utility that evaluates a lead record against a set of active scoring rules and sums the matching rule score values.
* **REST API Endpoints (`apps/api`)**:
  - `GET /api/lead-scoring-rules`: Fetch all scoring rules for the tenant.
  - `POST /api/lead-scoring-rules`: Create a new lead scoring rule.
  - `GET /api/leads/:id/score`: Calculate and return the score for a specific lead.
  - `POST /api/leads/:id/score/recalculate`: Recalculate and persist the score in custom attributes, logging an audit log entry and triggering a `lead.score_updated` webhook event.
* **Row-Level Security**:
  - Verify that all lead scoring rule CRUD operations and scoring calculations strictly adhere to tenant isolation context, ensuring no cross-tenant information leaks.
