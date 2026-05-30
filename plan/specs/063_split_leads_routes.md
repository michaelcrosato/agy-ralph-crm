# Spec 063 — Split `apps/api/src/routes/leads.ts` (962 lines)

## Description & Impact

`apps/api/src/routes/leads.ts` is 962 lines — 2.4× the 400-line budget limit. It contains many domain areas: standard lead CRUD (OpenAPIHono-enabled), SLA targets, SLA breaches tracker, duplicates checks, master/duplicate merges, lead conversion mapping, auto-conversion rule creation, assignment rules with entries, scoring rules, and scoring recalculations. Splitting by concern improves codebase navigability and modularity.

**Impact:** Brings the lead routing module under budget and keeps domain sub-routers highly focused.

## Definition of Done

- [ ] `apps/api/src/routes/leads.ts` reduced to ≤50 lines.
- [ ] Extracted sub-routers under `routes/leads/` directory:
  - `crud.ts` (Standard OpenAPI-enabled Hono CRUD endpoints)
  - `sla.ts` (SLA targets CRUD, breaches tracking, and response checkpoints)
  - `conversion.ts` (Auto-conversion rules CRUD and manual lead conversion mappings)
  - `dedup.ts` (Duplicates calculation and master/duplicate merging)
  - `assignment.ts` (Manual/automatic lead routing rules and rules CRUD)
  - `scoring.ts` (Score evaluations, recalculation, and scoring rules CRUD)
- [ ] All integration tests pass unchanged.
- [ ] `pnpm run agent:check` green.

## Approach

### Files to create/modify
- Modify `apps/api/src/routes/leads.ts` to act as the main mounting index.
- Create sub-files under `apps/api/src/routes/leads/`.

### Pattern
Use Hono sub-routers mounted under the main `leadsApp`, `leadAssignmentRulesApp`, and `leadScoringRulesApp`. Maintain all OpenAPI mappings and Zod schemas exactly unchanged.

## Test Strategy
Regression-only. Ensure all vitest suites for leads CRUD, conversions, SLA breaches, duplicates, assignment routing, and scoring remain 100% green.
