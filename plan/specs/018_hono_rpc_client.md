# 018 — Typed Hono RPC client for `apps/web`

**Phase:** 1 · **Priority:** Medium · **Status:** `[ ] Todo` · **Depends on:** 017

## Description & Expected Impact
Hono's `hc<typeof app>` client gives end-to-end type safety between API and web with zero codegen. After spec 017, the route types are precise enough to drive `apps/web` without manual fetch boilerplate.

## Definition of Done & Acceptance Criteria
- [ ] New `packages/api-client/` package exports `createApiClient(baseUrl)` returning `hc<AppType>` where `AppType = typeof import('apps/api/src')['default']`.
- [ ] `apps/web` consumes the client in at least 3 server components (`leads`, `accounts`, `opportunities` list pages).
- [ ] Type errors surface at build time when API contract changes (verified by deliberately changing a response shape on a feature branch).
- [ ] No new runtime deps in apps/web beyond what hc requires.

## Implementation Approach
- Hono RPC requires `"strict": true` in both client and server tsconfigs (already true).
- Export the API type from `apps/api/src/index.ts` as `export type AppType = typeof app`.
- The packages/api-client thin wrapper centralizes baseUrl + auth header injection.

## Test Strategy
- Compile gate: `pnpm build` must succeed.
- Manual: edit a route response shape, `pnpm verify` should flag a type error in `apps/web`.

## Rollback
Remove `packages/api-client`; revert apps/web to fetch.

## References
- [Hono RPC docs](https://hono.dev/docs/guides/rpc)
