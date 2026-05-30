# 017 — `@hono/zod-openapi` for type-safe routes + auto OpenAPI/Swagger

**Phase:** 1 · **Priority:** High · **Status:** `[ ] Todo` · **Depends on:** 010

## Description & Expected Impact
Hono routes are hand-validated today (mix of `await c.req.json()` + ad-hoc checks). `@hono/zod-openapi` turns Zod schemas into OpenAPI specs automatically + provides runtime validation + drives the typed RPC client for `apps/web` (spec 018). 2026 Hono best practice.

## Definition of Done & Acceptance Criteria
- [ ] Deps: `@hono/zod-openapi`, `@scalar/hono-api-reference` added to `apps/api`.
- [ ] All resource routers from spec 010 use `OpenAPIHono` and define routes via `createRoute({ method, path, request: { body: schema }, responses })`.
- [ ] `GET /openapi.json` exposes generated OpenAPI 3.1 doc.
- [ ] `GET /docs` serves Scalar API reference UI.
- [ ] Existing tests pass; validation behavior identical (use `zValidator` migration where needed).
- [ ] `pnpm test` 403/403.

## Implementation Approach
- Phase the migration: pick 1 router (`leads.ts`) and prove the pattern, then sub-agent batch the rest.
- Reuse Zod schemas from `packages/core` where possible.
- Output the OpenAPI doc to `apps/api/openapi.json` as a build artifact so `apps/web` can codegen.
- Keep response shapes identical (don't reshape during this spec).

## Test Strategy
- Regression: `pnpm test` 403/403.
- New tests: assert `GET /openapi.json` returns a parseable OpenAPI 3.1 doc with 100+ paths.

## Rollback
Revert routers to plain `Hono`; remove deps.

## References
- [Zod OpenAPI Hono](https://hono.dev/examples/zod-openapi)
- [Scalar API reference](https://github.com/scalar/scalar)
