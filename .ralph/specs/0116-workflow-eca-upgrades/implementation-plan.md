# Specification: Workflow Event-Condition-Action (ECA) Upgrades - Implementation Plan

## 1. Package Work
1. **Update `@crm/workflow` Types (`packages/workflow/src/index.ts`)**:
   - Define recursive condition types and extended action interfaces.
   - Refactor `executeWorkflows` to support nested condition evaluation and advanced action executions.
   - Inject optional `context` param containing `dbStore`, `userId`, and `orgId`.

## 2. API Server Work
1. **Pass Context to Workflow Engine (`apps/api/src/index.ts`)**:
   - Provide `dbStore`, `orgId`, and `userId` to `executeWorkflows` calls during Lead Conversion and Opportunity stage changes.
   - Handle and log actions executed under the active tenant context.

## 3. Testing Work
1. **Write Integration/Unit Tests (`packages/testing/src/workflow-eca-upgrades.test.ts`)**:
   - Assert recursive AND/OR logic works as intended.
   - Verify automated task creation adds activity and activityLink records correctly.
   - Verify picklist field updates change database state.
   - Verify slack-like webhook templates substitute variables correctly.
   - Assert RLS isolation blocks cross-tenant mutation leakages.
