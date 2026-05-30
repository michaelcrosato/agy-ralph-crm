# 013 — Wire real Postgres + Drizzle + testcontainers

**Phase:** 1 · **Priority:** High · **Status:** `[ ] Todo` · **Depends on:** 012

## Description & Expected Impact
`packages/db/src/index.ts` is an in-memory store; `packages/db/src/schema.ts` defines Drizzle Postgres tables but is **unused at runtime**. This divorces schema from behavior — a major debt and the central blocker for production. Plug real Postgres behind the same `stores/*` interfaces from spec 012 using Drizzle + `node-postgres` (or `postgres-js`). Use `@testcontainers/postgresql` for integration tests so the suite runs hermetically without dev DB.

## Definition of Done & Acceptance Criteria
- [ ] Add deps: `pg@^8.x` (already declared), `@testcontainers/postgresql@^11.x` (dev).
- [ ] `packages/db/src/client.ts` exports `createDbClient(connectionString)` returning a Drizzle instance.
- [ ] Each `stores/*.ts` from spec 012 grows two implementations: `*-mock.ts` (existing) and `*-pg.ts` (Drizzle queries).
- [ ] Factory `getStore(env)` picks impl: `env.DB_DRIVER === 'pg' ? pg : mock`.
- [ ] `.env.example` documents `DB_URL=postgres://postgres:postgres@localhost:5432/crm` and `DB_DRIVER=mock|pg`.
- [ ] `packages/db/drizzle.config.ts` configured for `drizzle-kit generate` + `migrate`.
- [ ] First migration generated (`drizzle/0000_init.sql`) and committed.
- [ ] At least 5 representative tests parametrized to run against BOTH backends (mock and testcontainers PG) — pick high-coverage ones (leads-api, opportunities-api, multi-currency, marketing-sequences, ticket-routing).
- [ ] CI gains a `test:pg` job using a postgres service container (in `.github/workflows/ci.yml`).
- [ ] Existing tests remain green on default mock backend.

## Implementation Approach
- Keep mock backend default in `vitest` to preserve CI speed.
- Use Drizzle's introspect-from-schema flow; do not hand-write SQL.
- For `set_config('app.current_tenant_id', $1, true)` — set inside a transaction per spec 014; this spec only wires the client, RLS policies come next.
- Type generation: `drizzle-kit generate` updates `packages/db/src/schema.ts` and `migrations/`.
- ID generation continues via spec 008 helper (`uuid v7`).

## Test Strategy
- Unit: mock backend continues current coverage.
- Integration: 5 parametrized suites against testcontainers PG. Each assert: insert + RLS isolation + delete cleanup.
- CI: `pnpm test:pg` job in workflow runs only on PR and only on Linux runners.

## Rollback
Revert `packages/db/src/` files; set `DB_DRIVER=mock` everywhere. No data loss because PG path is opt-in.

## References
- [Drizzle ORM docs](https://orm.drizzle.team/)
- [@testcontainers/postgresql](https://node.testcontainers.org/modules/postgresql/)
