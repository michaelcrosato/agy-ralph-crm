# 036 — pgvector + embeddings on Accounts/Contacts for semantic search

**Phase:** 2 · **Priority:** Medium · **Status:** `[ ] Todo` · **Depends on:** 013

## Description & Expected Impact
2026 baseline for CRM search includes semantic similarity (e.g., "find me accounts similar to Acme that haven't been contacted in 90 days"). Adopt pgvector + a small embedding model (OpenAI `text-embedding-3-small` or local sentence-transformer). Existing `packages/search/` already has trigram + Levenshtein; this adds the semantic layer.

## Definition of Done & Acceptance Criteria
- [ ] `pgvector` Postgres extension enabled (migration).
- [ ] Drizzle schema: `embeddings` table with `(tenant_id, entity_type, entity_id, embedding vector(1536), generated_at)`.
- [ ] Worker (`packages/core/src/domain/embeddings/embedder.ts`) generates embeddings on entity insert/update; queued.
- [ ] REST: `GET /api/search/semantic?entity=account&q=...&limit=10`.
- [ ] HNSW index for ANN: `CREATE INDEX … USING hnsw (embedding vector_cosine_ops)`.
- [ ] RLS enforced on the embeddings table.
- [ ] Tests: 3 integration covering insert→search→isolation.
- [ ] Embeddings provider abstracted; env var `EMBEDDINGS_PROVIDER=openai|local|mock` (default `mock` in tests).

## Implementation Approach
- Default to `mock` provider in tests (deterministic random unit vectors).
- Real provider injection at runtime via env.
- Batch embedding generation in worker to amortize API cost.

## Test Strategy
- Integration: 3 tests with mock provider.

## Rollback
Disable feature flag; embeddings table remains but unused.

## Implementation Notes (delivered on branch `spec/036-semantic-search`)

Delivered the semantic-search vector core in `packages/search/src/semantic.ts` (the
"semantic layer" the spec places in `packages/search`) — no credentials, no PG:

- `cosineSimilarity(a, b)`, `VectorIndex` (in-memory ANN stand-in), and
  `semanticSearch(provider, query, corpus, limit)` ranking by cosine.
- `createMockEmbeddingProvider(dims)` — deterministic seeded unit vectors (FNV-1a →
  mulberry32 → L2-normalized); same text → same vector. This is the spec's
  `EMBEDDINGS_PROVIDER=mock` default.
- 5 tests (cosine identity/orthogonal/opposite; provider determinism/unit-norm/dims;
  exact-match ranks first; limit; VectorIndex ranking). Full suite 456/456 green;
  `@crm/search` + `@crm/testing` verify clean.

### [ASSUMPTION]s (smallest-reversible, per mission guardrails)
- **pgvector + embeddings table + HNSW + RLS + embedder worker + REST route deferred:**
  the pgvector extension/migration, `embeddings` Drizzle table (`vector(1536)`),
  `domain/embeddings/embedder.ts` worker, `/api/search/semantic` route, and the real
  `openai`/`local` providers need PG (Docker) + apps/api + an embeddings API
  (credentials). They wire onto `EmbeddingProvider` + `cosineSimilarity`/`VectorIndex`.
  → follow-up. The mock provider keeps the search logic fully tested offline.

## References
- [pgvector](https://github.com/pgvector/pgvector)
