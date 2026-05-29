# Specification: Marketing Sequence Cloning & Template Copying Engine - Brief

## 1. Functional Objective
This feature introduces high-value **Marketing Sequence Cloning** capabilities. It allows sales and marketing operations to duplicate an entire marketing sequence—including all its steps, branches, A/B split-tests, exit triggers, and custom actions—with a single action. This enables teams to quickly replicate successful drip campaign structures, iterate on copy, or branch campaigns for different target groups without manually recreating complex relational step structures.

## 2. Technical Scope
- **Pure Core Logic**: Core sequence cloning method `cloneMarketingSequence(dbStore, sequenceId, newName, orgId)` will live in `@crm/core` to duplicate all campaign steps, branches, split tests, action triggers, exit rules, and tag linkages under strict tenant isolation.
- **REST Endpoints**:
  - `POST /api/sequences/:id/clone` - Duplicates the sequence with a new name.
- **Verification**: Complete unit and integration test coverage verifying multi-tenant isolation, step copying accuracy, action cloning, and correct error handling.
