# Specification: Opportunity Kanban Board Pipeline View API - Brief

## 1. Functional Objective
This feature introduces a dedicated Kanban pipeline view API for Opportunity records. The system will support retrieving opportunity pipelines grouped by stage (e.g. Prospecting, Qualification, Closed Won, etc.), aggregating count and total opportunity values for each stage, and executing secure stage transitions with full validation, audit logging, and workflow triggers.

## 2. Technical Scope
- **Tenancy Isolation**: The Kanban pipeline aggregation must fully respect active tenant RLS bounds.
- **REST Endpoints**:
  - `GET /api/opportunities/kanban` - Fetch Kanban stage summary blocks, count of deals, and sum of values per stage.
  - `POST /api/opportunities/kanban/transition` - Perform stage transition. Transitioning updates the stage, inserts audit trails, triggers stage-changed workflow actions, and records velocity histories.
- **Verification**: Complete unit and integration test coverage verifying RLS isolation, correct aggregate math, validation gate blocks, and event dispatching during transitions.
