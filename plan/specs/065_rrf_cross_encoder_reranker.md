# Spec 065 — RRF Search Cross-Encoder Reranking Engine

## Description & Impact

Currently, the CRM uses **Reciprocal Rank Fusion (RRF)** to combine trigram fuzzy search and vector embedding cosine-similarity search into a single unified hybrid result set. While RRF is excellent at consensus ranking, it is a rank-level fusion algorithm that does not evaluate deep sentence-level semantic relevance between the query and matched records.

To achieve frontier-tier search relevance, we will implement a **Cross-Encoder Reranking Engine** on top of RRF hybrid search. Cross-Encoders evaluate the query and the candidate document simultaneously, yielding a highly accurate relevance score that significantly out-performs standard bi-encoders.

**Impact:** Places the most semantically relevant accounts and contacts at the very top of search results, resolving complex conceptual searches elegantly.

## Definition of Done

- [ ] Implement `rerankSearchHits` utility in `packages/search/src/rerank.ts` (and export from `index.ts`) supporting both a high-fidelity local mock cross-encoder (for test and offline runs) and an extensible network-based reranker.
- [ ] Incorporate the reranker into `globalHybridSearch` under a customizable `rerank` flag inside `HybridSearchOptions`.
- [ ] Expose reranking controls (e.g. `?rerank=true` and `?rerankLimit=5`) on the `GET /api/search/hybrid` Hono endpoint.
- [ ] Integration tests in `packages/testing/src/rerank-search.test.ts` verifying:
  - (a) Reranker successfully rearranges RRF candidate hits based on fine-grained sentence semantics.
  - (b) Strict organization-level RLS tenant isolation is maintained (no leaks).
  - (c) Graceful fallback when the reranking provider encounters network or API errors.
- [ ] All workspace type-checks, lints, and test suites pass cleanly.

## Approach

### Files to create/modify
- `packages/search/src/rerank.ts` — implement Cross-Encoder scoring and reranking
- `packages/search/src/index.ts` — export rerank functions and wire into `globalHybridSearch`
- `apps/api/src/routes/productivity.ts` — parse `rerank` and `rerankLimit` parameters and pass to the search options
- `packages/testing/src/rerank-search.test.ts` — write regression integration tests

### Reranking Algorithm
1. Retrieve candidate hits from `globalHybridSearch` up to a configurable limit (e.g., top 10).
2. For each hit, format a context string combining all searchable text fields.
3. Compute the Cross-Encoder relevance score $S(\text{query}, \text{context})$ for the query-document pair.
4. Re-sort candidates descending by their Cross-Encoder relevance score.

## Test Strategy

- Register mock accounts with names that are conceptually similar to a query but have low token overlaps, and others with high token overlaps but low conceptual similarity.
- Execute hybrid search with reranking enabled and assert that the conceptually matched record is reranked to rank 1.
- Assert strict active tenant RLS bounds.
