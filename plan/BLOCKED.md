# /plan/BLOCKED.md — Blocked items

> No in-scope specs remain blocked. Cores for 031/032/033/036/037/038/042 are
> delivered and merged. What remains are deferred follow-up **layers** (apps/api
> routes, Postgres migrations/triggers, real embedding providers, storage sinks),
> documented in each spec's Implementation Notes — they need apps/api + DB/Docker +
> credentials and are the integrating (full-stack) executor's domain.

## Deferred follow-up layers (cores merged; these wire on top)

- **031** — Drizzle `custom_entity_*` tables, `/api/custom/:typeName` CRUD, MCP tools,
  RLS. Core delivered: `defineObject()` + `CustomObjectRegistry` (`148bea3`).
- **033** — completed in full by the integrating writer (`29b8281`: route + RLS + PG
  tests). My core branch `spec/033-dashboard-analytics` is redundant — do not merge.
- **036** — pgvector extension/migration, `embeddings` table + HNSW index, embedder
  worker, `/api/search/semantic` route, real `openai`/`local` providers. Core
  delivered: cosine + deterministic mock provider + `VectorIndex` (`da4ce20`).
- **038** — Postgres `REVOKE UPDATE/DELETE` + `audit_logs_immutable` trigger migration,
  fs/S3 export sink + daily job. Core delivered: SHA-256 hash chain + Merkle WORM
  export + verifier (`1afb962`).

## Fixed

- `pnpm-workspace.yaml` `allowBuilds` placeholders (`set this to true or false`) for
  `ssh2` / `cpu-features` are now set to `false`, so fresh installs / CI pass the turbo
  build gate (previously `ERR_PNPM_IGNORED_BUILDS`, exit 1).
