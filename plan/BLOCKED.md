# /plan/BLOCKED.md — Items blocked for the isolated worktree agent

> These specs require resources/ownership an isolated agent (no Docker control, no
> secrets, avoiding the concurrent writer that owns `main` + `apps/api` + `packages/db`)
> cannot safely provide. The writer (on `main`, full stack) is the correct executor.

## Blocked specs (in-scope drain)

- [!] **036 — pgvector + embeddings.** Generating embeddings needs an external
  embeddings model/API (credentials/secrets) — unavailable AFK and forbidden by the
  guardrails. Real semantic search can't be implemented or tested without it; mocking
  embeddings would be homework. Needs: an embeddings provider + the pgvector extension.

- [!] **033 — tRPC dashboard analytics.** The tRPC router lives in `apps/api` and the
  client in `apps/web` — the concurrent writer owns `apps/api` (specs 017/018, actively
  merging). Adding routes there violates "one writer per file". The pure analytics
  computation could later be extracted to `packages/core`; the transport is the writer's.

- [!] **038 — audit log append-only Postgres + WORM.** Append-only enforcement is PG
  triggers/policies in `packages/db`, where the writer is actively working (RLS fixes,
  just merged). High file-collision risk on the same DB layer. Writer's domain.

## Environment bug (needs a fix on main)

- `pnpm-workspace.yaml` `allowBuilds` ships unfilled placeholder values from spec 013
  (`cpu-features: set this to true or false`, `ssh2: ...`). pnpm 11 errors
  (`ERR_PNPM_IGNORED_BUILDS`, exit 1) on fresh installs → CI / clean clones fail the
  turbo build gate. Fix: set both to `false` (or `true`). Applied worktree-locally to
  build/test; not committed (the value is the maintainer's call).

## Delivered by this agent (isolated branches, ready to merge)

- `spec/042-sequences-split`     `c5e884e` — 4,303-line sequences/index.ts → 8 modules (010/011 budget)
- `spec/032-workflow-conditions` `e991c18` — IF/FOREACH step engine + DSL parser (8 tests)
- `spec/037-streaming-csv`       `d1f0b80` — constant-memory streaming CSV core (5 tests) — MERGED to main (`cb4c4ad`)
- `spec/031-define-object`       `37fd48e` — defineObject() SDK core, all 8 field types (8 tests)
