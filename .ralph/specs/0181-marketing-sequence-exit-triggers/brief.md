# Specification: Marketing Sequence Exit Triggers Engine - Brief

## 1. Functional Objective
In marketing automation, sending emails to prospects who have already converted or closed a deal can damage reputation and relationships. This feature introduces automated Exit Triggers to Marketing Sequences (Drip Journeys). 
Marketing managers can define automated exit criteria (e.g., Lead Status changes to 'Converted', or an Opportunity associated with the Contact's Account becomes 'Closed Won'). The sequence execution loop will evaluate these triggers and automatically unenroll (mark status as 'completed' or 'unsubscribed') matching members before dispatching the next email.

## 2. Technical Scope
- **Database Schema**: Add `marketing_sequence_exit_triggers` under `packages/db` with tenant RLS isolation.
- **Core Integration**: Update sequence execution to check and evaluate exit triggers for each active membership before sending email steps.
- **REST Endpoints**:
  - `GET /api/sequences/:id/exit-triggers` - Retrieves all exit triggers for a sequence.
  - `POST /api/sequences/:id/exit-triggers` - Creates a new automated exit trigger.
  - `DELETE /api/sequences/:id/exit-triggers/:triggerId` - Deletes an exit trigger.
- **Verification**: Thorough integration tests asserting that exit triggers are evaluated correctly, memberships are unenrolled, and tenant RLS isolation is enforced.
