# Task 0160: Support Ticket CSAT Feedback Integration - Brief

## 1. Functional Objective
Providing excellent customer service requires understanding agent performance and customer satisfaction. To support this, the CRM ticketing subsystem needs a **Support Ticket CSAT Feedback & Agent Performance Engine**.

This feature allows:
1. Customers/Contacts to submit a **Customer Satisfaction (CSAT) rating** (score 1-5, with an optional text comment) linked to a specific resolved/closed support ticket.
2. Managers/Tenants to retrieve CSAT feedback for any ticket to assess customer happiness.
3. Automatically calculating metrics for support agents (`users`), including:
   - Average CSAT score per agent.
   - CSAT satisfaction rate (percentage of scores that are 4 or 5).
   - Average resolution time (in minutes) for closed/resolved tickets.
4. Exposing REST endpoints to submit feedback, query ticket feedback, and list agent performance metrics under active tenant Row-Level Security (RLS).

## 2. Technical Scope
- **Database Schema**:
  - Update `survey_responses` schema table definition in `packages/db/src/schema.ts` to include an optional `ticketId` referencing `tickets`.
  - Extend the global in-memory `store.surveyResponses` types/CRUD methods in `packages/db/src/index.ts` to handle and retrieve by `ticketId`.
- **Core Pure Logic**:
  - Implement CSAT validation and agent metrics aggregation helpers in `packages/core/src/index.ts`.
- **REST Endpoints**:
  - `POST /api/service/tickets/:id/feedback` - Submits a customer feedback rating for a specific ticket.
  - `GET /api/service/tickets/:id/feedback` - Retrieves feedback associated with a specific ticket.
  - `GET /api/service/agents/:id/metrics` - Retrieves aggregated performance and CSAT metrics for a specific agent.
- **Tenant RLS & Security**:
  - All operations must run strictly within the active tenant's context (`orgId`). A tenant must never see, modify, or submit feedback for tickets belonging to other organizations.
- **Verification & Integration Tests**:
  - Write integration tests inside `packages/testing/src/ticket-csat.test.ts` validating feedback submission, agent metrics calculations, RLS isolation, and audit log generation.
