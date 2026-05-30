# 032 — Add `IF` conditions + `FOREACH` loops to workflow engine

**Phase:** 2 · **Priority:** High · **Status:** `[ ] Todo` · **Depends on:** 011

## Description & Expected Impact
Twenty 2.0's workflow engine **lacks IF conditions + FOREACH loops** as of early 2026 — public competitive analysis flags this as a real gap. Repo's `packages/workflow` has the same gap. Closing it = competitive differentiation + unlocks complex automations (e.g., "for each contact on this account, if last activity > 30 days, send re-engagement email").

## Definition of Done & Acceptance Criteria
- [ ] `packages/workflow/src/steps/if.ts` — IF step with `{ condition: ZodSchema, then: Step[], else?: Step[] }`.
- [ ] `packages/workflow/src/steps/foreach.ts` — FOREACH step with `{ collection: Expression, item: VariableName, body: Step[], maxIterations: 1000 }`.
- [ ] `packages/workflow/src/dsl/conditions.ts` — expression grammar for `field comparator value` ops (`==`, `!=`, `>`, `<`, `in`, `contains`, `matches`).
- [ ] DSL parsed via a small recursive-descent function; no eval/Function.
- [ ] `maxIterations` cap enforced + tested (infinite-loop guardrail).
- [ ] REST: `/api/workflows/:id/steps` accepts IF + FOREACH step types with Zod validation (spec 017 compatible).
- [ ] 8 new tests covering nested IF/FOREACH, short-circuit, max-iteration cap, RLS, and execution traces.

## Implementation Approach
- Steps are stored as JSONB tree; engine walks the tree.
- Foreach iterates a resolved collection (e.g., `account.contacts`) bound to a variable in the local execution context.
- Conditions evaluated against the same context.
- Snapshot execution path in `workflow_runs.execution_trace` JSONB for debugging.

## Test Strategy
- Unit: parser tests for each operator + nesting.
- Integration: 8 new workflow runs covering happy + error paths.

## Rollback
Disable IF + FOREACH step types in validator (returns 400).
