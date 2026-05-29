# Specification: Customer Satisfaction (CSAT) & NPS Survey Engine - Implementation Plan

We will implement the feature following a clean, incremental path, ensuring compiler verification and zero RLS leaks at every step.

## Step 1: Database Schema Definitions
- Edit [schema.ts](file:///C:/dev/agy-ralph-crm/packages/db/src/schema.ts):
  - Add and export `surveys` and `surveyResponses` `pgTable` objects.
- Edit [index.ts](file:///C:/dev/agy-ralph-crm/packages/db/src/index.ts):
  - Export interfaces `DBSurvey` and `DBSurveyResponse`.
  - Add them to the static `store` object.
  - Implement the `dbStore.surveys` and `dbStore.surveyResponses` mock CRUD adapters, complete with `getActiveOrgId` and RLS assertions (`req.orgId === orgId`).
  - Add their clearing logic in `dbStore.clear()`.

## Step 2: Core Domain Logic
- Edit [index.ts](file:///C:/dev/agy-ralph-crm/packages/core/src/index.ts):
  - Implement and export `validateSurveyResponse`.
  - Implement and export `calculateSurveyMetrics`.

## Step 3: API REST Endpoints
- Edit [index.ts](file:///C:/dev/agy-ralph-crm/apps/api/src/index.ts):
  - Import the core functions and types.
  - Register Hono routing endpoints:
    - `POST /api/sales/surveys`
    - `GET /api/sales/surveys`
    - `POST /api/sales/surveys/responses`
    - `GET /api/sales/surveys/:id/metrics`
  - Ensure all routes are guarded by the `tenantAuth` middleware to bind queries securely inside the tenant's transaction block.
  - Log audit trails when survey campaigns are created or responses are submitted.

## Step 4: Integration & Security Verification
- Create [surveys.test.ts](file:///C:/dev/agy-ralph-crm/packages/testing/src/surveys.test.ts):
  - Write test cases verifying survey campaigns and survey responses CRUD.
  - Verify validation constraints (boundary score values) throw clean 400 errors.
  - Assert that cross-tenant access to surveys or responses throws an RLS isolation violation.
- Run `pnpm verify` to check formatting, typescript compilation, and linting.
- Git commit the changes.
