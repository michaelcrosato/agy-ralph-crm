# Specification: Workflow Event-Condition-Action (ECA) Upgrades - Brief

## 1. Functional Objective
This feature enhances the CRM's core Event-Condition-Action (ECA) workflow automation engine. It introduces a nested AND/OR condition evaluation engine for complex, multi-criteria filtering, and adds three powerful advanced action types: automated task activity creation, tenant-isolated picklist field updates, and templated slack-like webhook payloads.

## 2. Technical Scope
- **Nested Condition Parser**: Upgrade the condition parsing engine in `@crm/workflow` to support recursive logical matching (nested `all`/`AND` and `any`/`OR` groups) alongside simple field comparisons.
- **Advanced Workflow Actions**:
  - `task`: Automatically spawn activities of type `task` linked to the triggering record, governed by active tenant boundaries.
  - `field_update`: Automatically update field values (e.g. stage picklists) on the triggering record.
  - `webhook` templates: Inject event payload fields directly into webhook endpoints or body payloads using slack-like `{field_name}` bracket templates.
- **Tenancy Isolation & RLS Enforcement**: All automated actions must be executed under the active tenant `AsyncLocalStorage` context, guaranteeing RLS is never bypassed.
- **REST and Integration Verification**: Comprehensive integration and API tests validating advanced rule creation, evaluation of nested rules, and automatic execution of advanced side-effects.
