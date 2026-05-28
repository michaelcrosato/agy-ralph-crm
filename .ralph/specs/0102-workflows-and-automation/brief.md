# Specification: Workflow REST API & Event-Triggered Automation - Brief

## Objective
Establish the Hono REST API for workflow rules management, and integrate the Event-Condition-Action (ECA) workflow engine to automatically trigger webhooks and alerts when CRM entities (like Opportunities) change stages.

## Boundaries & Constraints
- Workflow rules and active engine parameters must reside in `packages/workflow`.
- Table representations for workflows and RLS accessors must reside in `packages/db`.
- API endpoints for configuring workflows and handlers that capture stage updates must reside in `apps/api`.
- All automation hooks must execute safely under strict tenant isolation.
