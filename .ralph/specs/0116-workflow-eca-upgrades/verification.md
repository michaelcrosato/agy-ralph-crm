# Specification: Workflow Event-Condition-Action (ECA) Upgrades - Verification

## 1. Automated Verification
- Run `pnpm verify` from the workspace root to check for:
  - Perfect TypeScript compilation.
  - Total lint coverage and formatting compliance.
  - Complete integration and RLS regression tests passing.

## 2. Test Scenarios
- **SCENARIO-1**: A workflow rule with nested conditions `all` (AND) and `any` (OR) correctly triggers only when all/any conditions match.
- **SCENARIO-2**: Spawning an automated task adds a task activity linked to the opportunity, with correct due date offset.
- **SCENARIO-3**: Performing a picklist field update transitions opportunity stage automatically.
- **SCENARIO-4**: Slack-like webhook template correctly renders dynamic event properties.
- **SCENARIO-5**: Standard RLS rules ensure one tenant's workflow execution never triggers tasks, updates fields, or leaks context to another organization.
