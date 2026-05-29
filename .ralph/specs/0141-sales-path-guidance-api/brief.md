# Spec 0141: Sales Path Guidance API Brief

## Objective
Introduce a flexible Sales Path Guidance (Guidance-for-Success) engine into the CRM core. In professional sales organizations, administrators configure a "Sales Path" for key objects like Opportunities or Leads. For each stage of the sales pipeline, administrators can configure:
1. **Key Fields**: A list of crucial fields that the sales representative should focus on and populate when a record is in that stage.
2. **Guidance for Success**: Clear notes, best practices, checklist items, and instructions (as rich text/markdown strings) to guide the representative through the stage.

This specification introduces a customizable `stage_guidance` schema and matching core, database, API, and validation routines under strict tenant Row-Level Security (RLS) isolation. It helps improve data hygiene, provides context-aware enablement for sales reps, and enforces structured progression guidelines.

## Scope
* **Database & Persistence**: Update `packages/db` with a new `stage_guidance` schema to persist guidance records (object type, stage, key fields, guidance text, isActive). Update `packages/db/src/index.ts` to support querying, saving, and updating guidance rules under active tenant RLS isolation.
* **Core Logic**: Implement a pure formatter/validator utility `validateStageGuidanceKeyFields` in `packages/core` that inspects a record (e.g. an Opportunity or Lead) and checks if the configured key fields for its current stage are fully populated, returning warning messages for missing fields.
* **REST API Endpoints**:
  - `GET /api/stage-guidance`: Retrieve all configured stage guidance records for the authenticated tenant.
  - `GET /api/stage-guidance/:objectType/:stage`: Fetch the active stage guidance and key fields configuration for a specific object type and stage.
  - `POST /api/stage-guidance`: Create or update a stage guidance record (objectType, stage, keyFields, guidanceText, isActive).
* **RLS & Security Boundaries**: Enforce strict isolation. No tenant should be able to view, query, or modify the stage guidance configurations of another tenant.
