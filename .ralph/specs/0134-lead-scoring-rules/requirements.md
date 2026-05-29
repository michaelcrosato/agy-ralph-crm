# Spec 0134: Lead Scoring Rules Requirements

## 1. Functional Requirements

### Database Schema Expansion
* **R1.1**: The `lead_scoring_rules` table must be added to `packages/db/src/schema.ts` containing `id` (primary key), `orgId` (references organization), `name` (text), `criteria` (jsonb array of Criteria Conditions), `scoreValue` (integer), and `isActive` (integer, default 1).
* **R1.2**: Tenant isolation must be maintained: rules must only point to an organization belonging to the active tenant context.

### Business Logic Core (`packages/core`)
* **R2.1**: **Lead Score Calculation**: Implement a function `calculateLeadScore(lead: Record<string, unknown>, rules: { id: string; isActive: number; scoreValue: number; criteria: CriteriaCondition[] }[]): number` in `packages/core/src/index.ts`.
  - It must evaluate criteria against the lead record, including support for custom fields (e.g. fields prefixed with `custom.`).
  - It must sum up the `scoreValue` of all active matching rules.

### Store Engine Expansion (`packages/db`)
* **R3.1**: The `leadScoringRules` store in `packages/db/src/index.ts` must support findMany, findOne, insert, update, and delete under active tenant RLS isolation.

### REST API Endpoints (`apps/api`)
* **R4.1**: **GET `/api/lead-scoring-rules`**: Fetch all lead scoring rules for the current tenant.
* **R4.2**: **POST `/api/lead-scoring-rules`**: Insert a new lead scoring rule, validating the request body and ensuring the active tenant context. Log an audit log entry for `create_rule`.
* **R4.3**: **GET `/api/leads/:id/score`**: Fetch the lead, calculate the score using `calculateLeadScore` on the active scoring rules, and return the calculated score `{ leadId: string, score: number }` without persisting.
* **R4.4**: **POST `/api/leads/:id/score/recalculate`**: Calculate the score, persist it as a `score` custom attribute on the lead record, log an audit log entry `recalculate_score`, and dispatch a `lead.score_updated` webhook event.

## 2. Non-Functional & Security Requirements

* **S1.1**: **No Cross-Tenant Contamination**: Rules belonging to one tenant must never be used to calculate a lead's score for another tenant.
* **S1.2**: All operations must operate within the active `AsyncLocalStorage` tenant context.
* **N1.1**: The evaluation should handle all operators (`equals`, `contains`, `greater_than`, `less_than`) cleanly and protect against invalid types or missing attributes.
