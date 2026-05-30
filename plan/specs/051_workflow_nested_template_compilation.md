# 051 — Workflow Nested JSON Path Template Compilation

**Phase:** 2 (Replenish) · **Priority:** Medium · **Status:** `[x] Done` · **Depends on:** 032

## Description & Expected Impact

Currently, the Event-Condition-Action (ECA) workflow engine's template interpolation in webhook and notification actions uses a simple root-level key regex replacement. When complex event payloads containing nested objects or custom attributes are passed (e.g. `{custom.score}` or `{contact.email}`), the engine fails to resolve the nested keys, or incorrectly stringifies nested objects as `"[object Object]"`.

We will raise the workflow engine's capability by implementing:
1. **JSON Path / Dot-Notation Resolution**: Support resolving nested attributes (like `{custom.score}` or `{contact.email}`) using the existing `resolvePath` utility.
2. **Object Serialization**: Safely serialize nested objects or arrays to JSON format instead of printing `"[object Object]"`.

## Definition of Done & Acceptance Criteria

- [x] **Robust Template Compilation (`packages/workflow/src/index.ts`)**:
  - Implement a centralized `compileTemplate(template, payload)` function resolving nested dot-notation paths using `resolvePath`.
  - Safely serialize object/array values to JSON strings.
  - Intercept and compile template strings for both `webhook` and `notification` action types.
- [x] **Integration & Unit Tests**:
  - Create integration test cases under `packages/testing/src/workflow-eca-upgrades.test.ts` or a new file verifying resolution of nested keys and object serialization.
  - Ensure all 490+ workspace tests remain fully green.
