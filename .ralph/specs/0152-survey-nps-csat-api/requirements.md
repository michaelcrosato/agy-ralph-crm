# Specification: Customer Satisfaction (CSAT) & NPS Survey Engine - Requirements

## 1. Functional Requirements

### 1.1 Survey Campaign Management
- Users must be able to create survey campaigns.
- A survey campaign must capture:
  - `name` (string, required)
  - `type` (string, required, either `"csat"` or `"nps"`)
  - `status` (string, required, defaulted to `"draft"`. Valid values are `"draft"`, `"active"`, `"closed"`)
  - `createdAt` (Date, required, defaulted to current time)

### 1.2 Survey Responses
- Survey responses must be associated with a valid survey campaign.
- A survey response must capture:
  - `surveyId` (UUID string, required)
  - `contactId` (UUID string, optional, references an existing Contact)
  - `score` (integer, required)
  - `comment` (string, optional)
  - `createdAt` (Date, required, defaulted to current time)

### 1.3 Score Validation Rules
- Survey response score validations must follow strict bounds based on the survey campaign type:
  - For `"csat"` surveys: Score must be an integer between 1 and 5 (inclusive).
  - For `"nps"` surveys: Score must be an integer between 0 and 10 (inclusive).
- Any invalid score must throw a validation error during response submission.
- Only `"active"` survey campaigns can accept responses. If the survey status is `"draft"` or `"closed"`, response submission must be blocked.

### 1.4 Survey Metrics Aggregation
- The metrics engine must compute:
  - `count`: Total count of responses.
  - `averageScore`: Decimal representation of average score (rounded to two decimal places).
  - `scorePercentage`:
    - For `"csat"`: The percentage of satisfied responses (score >= 4), rounded to two decimal places.
    - For `"nps"`: The Net Promoter Score calculated as: `Promoters % - Detractors %` (promoters: 9-10, passives: 7-8, detractors: 0-6). The value must be an integer between -100 and 100.
- If there are zero responses, the metrics must return:
  - `count`: 0
  - `averageScore`: 0.00
  - `scorePercentage`: 0.00 (or 0 for NPS)

## 2. Security & RLS Isolation Requirements
- **Tenant Context**: Every database read and write to surveys and survey responses must be bound strictly to the active tenant (`orgId`).
- **Cross-Tenant Prevention**: Direct mutations, metrics queries, or responses for a survey belonging to another tenant must throw an RLS isolation violation.

## 3. Interface Requirements

### 3.1 REST API Contracts
- `POST /api/sales/surveys`:
  - Body: `{ name: string, type: "csat" | "nps", status?: "draft" | "active" | "closed" }`
  - Returns: `{ success: true, data: Survey }`
- `GET /api/sales/surveys`:
  - Returns: `{ success: true, data: Survey[] }`
- `POST /api/sales/surveys/responses`:
  - Body: `{ surveyId: string, contactId?: string, score: number, comment?: string }`
  - Returns: `{ success: true, data: SurveyResponse }`
- `GET /api/sales/surveys/:id/metrics`:
  - Returns: `{ success: true, data: { count: number, averageScore: string, scorePercentage: number } }`
