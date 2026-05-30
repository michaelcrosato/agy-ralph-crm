# Spec 062 — Split `apps/api/src/routes/service.ts` (1,196 lines)

## Description & Impact

`apps/api/src/routes/service.ts` is 1,196 lines — 3× the 400-line budget limit. It contains many domain areas: support ticket routing rules, SLAs, knowledgebase articles, tags, comments, CSAT surveys, macros, and agent performance metrics. Splitting by concern improves readability, code hygiene, and complies with the monorepo standards.

**Impact:** Brings the service routing module under the 400-line budget and makes domain routers highly focused.

## Definition of Done

- [ ] `apps/api/src/routes/service.ts` reduced to ≤50 lines.
- [ ] Extracted sub-routers under `routes/service/` directory:
  - `routing.ts` (Rules CRUD + Manual/Auto ticket routing)
  - `sla.ts` (SLA policies, Milestones, Escalations)
  - `kb.ts` (Knowledgebase categories and articles)
  - `tags.ts` (Ticket tags and linking)
  - `macros.ts` (Macros management and applying macros)
  - `comments.ts` (Ticket comments)
  - `feedback.ts` (CSAT feedback surveys and agent metrics)
- [ ] All integration tests pass unchanged.
- [ ] `pnpm run agent:check` green.

## Approach

### Files to create/modify
- Modify `apps/api/src/routes/service.ts` to be the entry point mounting the sub-apps.
- Create sub-files under `apps/api/src/routes/service/`.

### Pattern
Use Hono sub-routers mounted under the main `serviceApp`. Ensure RLS tenancy, authentication, and correct middleware are maintained.

## Test Strategy
Regression-only. Ensure all vitest suites for ticketing, CSAT, macros, KB, and SLA routing remain 100% green.
