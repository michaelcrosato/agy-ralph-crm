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

## Implementation Notes (delivered on branch `spec/032-workflow-conditions`)

Built as a self-contained step-program subsystem in `packages/workflow`, additive to
the existing flat ECA engine (`executeWorkflows`) — no behavior change to the latter:

- `dsl/conditions.ts` — hand-rolled tokenizer + recursive-descent parser/evaluator
  (no `eval`/`Function`); operators `==`, `!=`, `>`, `<`, `in`, `contains`, `matches`;
  operands are literals, `[...]` arrays, or dotted context paths.
- `steps/if.ts`, `steps/foreach.ts` — IF/FOREACH step types + Zod schemas + handlers.
- `steps/execute.ts` — `executeSteps(steps, context)` tree-walker returning
  `{ actions, trace, iterations }` (the trace is the in-memory execution-path snapshot).
- `steps/schema.ts` — recursive `stepSchema` (`z.lazy`) + `parseStepProgram` /
  `safeParseStepProgram`. `maxIterations` capped at 1000 (Zod schema + runtime guard).
- 8 tests in `packages/testing/src/workflow-steps.test.ts` (then/else short-circuit,
  nested IF, foreach binding, max-iteration cap, trace order, every DSL operator, Zod
  validation). Suite 418/418 green; `@crm/workflow` + `@crm/testing` verify clean.

### [ASSUMPTION]s (smallest-reversible, per mission guardrails)
- **Architecture:** the repo's `packages/workflow` is a flat ECA rules engine, not the
  JSONB step-tree the spec assumed. Implemented the step engine *alongside* ECA rather
  than refactoring the existing engine (non-breaking, reversible).
- **REST `/api/workflows/:id/steps`: deferred.** A concurrent agent owns `apps/api`
  (specs 017/018 in flight); adding a route there now would collide ("one writer per
  file"). The Zod validator (`parseStepProgram`) is exported and ready, so the route is
  a thin follow-up once 017/018 land. → follow-up.
- **RLS / `workflow_runs.execution_trace` persistence: N/A** for the pure engine layer;
  RLS is enforced at the DB/store boundary (spec 014). The trace is returned in-memory;
  persistence belongs with the route/DB wiring above.
