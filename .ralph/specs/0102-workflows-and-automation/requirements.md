# Specification: Workflow REST API & Event-Triggered Automation - Requirements

## Functional Requirements
1. **Workflow API Endpoints:**
   - `POST /api/workflows` - Registers a workflow rule for the active tenant, containing trigger event name, conditional field rules, and a list of actions (webhooks/notifications).
   - `GET /api/workflows` - Lists all workflow rules configured for the active tenant.
2. **Event Automation Engine Integration:**
   - When an Opportunity stage change occurs, automatically dispatch an `opportunity.stage_changed` workflow event.
   - Run the event against the tenant's rules using `@crm/workflow`'s `executeWorkflows`.
   - Log any successfully triggered webhooks or alerts, returning them as metadata in the response.

## Verification Requirements
1. **Automation Rule Tests:**
   - Verify that adding a workflow rule (e.g., if stage equals "Closed Won" then trigger webhook and alert) does not trigger actions when another stage is set.
   - Verify that actions trigger perfectly when the stage transition matches the condition.
   - Assert RLS isolation restricts tenants from seeing or firing each other's rules.
2. **TypeScript & Biome Standards:**
   - The entire codebase must compile and lint perfectly.
