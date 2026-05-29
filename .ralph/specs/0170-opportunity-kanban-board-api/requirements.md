# Specification: Opportunity Kanban Board Pipeline View API - Requirements

## 1. Functional Requirements

### 1.1 Kanban Pipeline Aggregation
- **REQ-1.1.1**: The system must allow querying current active opportunities grouped by stage.
- **REQ-1.1.2**: For each stage, the response must summarize:
  - `stage`: Name of the stage (e.g. "Prospecting", "Closed Won").
  - `opportunitiesCount`: Total number of opportunities currently in this stage.
  - `totalValue`: Sum of `amount` values of opportunities in this stage, formatted as a string representation of standard precision (e.g. "25000.00").
  - `opportunities`: A list of opportunity summary objects containing: `id`, `name`, `amount`, `closeDate`, `accountId`.
- **REQ-1.1.3**: RLS tenant isolation must govern the Kanban data compilation. Only opportunities belonging to the authenticated tenant may be aggregated.

### 1.2 Kanban Stage Transition
- **REQ-1.2.1**: The system must support transitioning an opportunity between stages.
- **REQ-1.2.2**: Transitioning requires parameters: `opportunityId` and `targetStage`.
- **REQ-1.2.3**: The transition must perform:
  - Validate the opportunity exists and belongs to the active tenant (RLS isolation).
  - Verify stage validation gates (Opportunity Stage Gates) using the core `validateOpportunityStageGate` engine. If validation fails, return 400 with the error message.
  - Update the opportunity record with `stage = targetStage`.
  - Insert a record in the opportunity stage history (`opportunityStageHistory`) tracking the stage change from the old stage to the target stage, changing user ID, and the amount.
  - Log an audit trail (`auditLogs`) recording the change in the opportunity stage.
  - Trigger any automated workflow rules (`workflows`) matching the `"opportunity.stage_changed"` event.
  - Trigger outbound webhook dispatches matching the `"opportunity.stage_changed"` event.

## 2. Security & Verification Requirements
- **REQ-2.1**: Strict tenant RLS: a tenant must never be allowed to view the Kanban board or trigger transitions for opportunities belonging to another tenant org.
- **REQ-2.2**: Complete TypeScript compilation with zero errors.
- **REQ-2.3**: Comprehensive Vitest validation confirming aggregate calculations, validation gate blocks, and event execution during transitions.
