# Specification: Customer Satisfaction (CSAT) & NPS Survey Engine - Brief

## 1. Functional Objective
A key driver of enterprise SaaS CRM value is feedback loop automation. Modern commercial CRMs manage customer feedback surveys (CSAT and NPS) natively to track post-opportunity customer sentiments or post-case resolution satisfaction.

This feature introduces the **Customer Satisfaction (CSAT) & NPS Survey Engine**. The system will:
1. Allow tenants to create survey campaigns of type `"csat"` or `"nps"` with a status of `"active"`, `"draft"`, or `"closed"`.
2. Support recording survey responses linked to survey campaigns and contacts. A response will include a score and an optional text comment.
3. Validate response scores according to the survey type (CSAT: score integer 1-5; NPS: score integer 0-10).
4. Provide a pure calculation engine in `packages/core` to calculate the aggregate metrics of a survey:
   - Total responses count.
   - Average score.
   - Percentage of satisfied customers (CSAT: score >= 4).
   - Net Promoter Score (NPS: promoters percentage [9-10] minus detractors percentage [0-6]), yielding an integer score from -100 to 100.
5. Expose REST endpoints to manage surveys, record responses, and query aggregate real-time metrics under active Row-Level Security (RLS) tenant isolation.
6. Automatically record CRM audit trails when survey campaigns are created or responses are submitted.

## 2. Technical Scope
- **Database Schema**:
  - Add `surveys` and `surveyResponses` tables to `packages/db/src/schema.ts` and update the store in `packages/db/src/index.ts`.
- **Core Pure Logic**:
  - Implement `validateSurveyResponse` and `calculateSurveyMetrics` in `packages/core/src/index.ts` to perform pure validation and arithmetic aggregation logic.
- **REST Endpoints**:
  - `POST /api/sales/surveys` - Creates a new survey campaign.
  - `GET /api/sales/surveys` - Queries survey campaigns for the active tenant.
  - `POST /api/sales/surveys/responses` - Submits a survey response, verifying RLS constraints and score boundaries.
  - `GET /api/sales/surveys/:id/metrics` - Fetches calculated metrics for a survey campaign.
- **Tenant RLS & Security**:
  - All operations must run strictly within the active tenant's context (`orgId`). A tenant must never see or submit responses to surveys belonging to other organizations.
- **Verification & Integration Tests**:
  - Write integration tests inside `packages/testing/src/surveys.test.ts` validating survey lifecycle, validation constraints, and tenant RLS isolation.
