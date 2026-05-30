# Spec 064 — Reciprocal Rank Fusion (RRF) Hybrid Search (Lexical + Semantic)

## Description & Impact

Currently, the CRM has a lexical trigram-based fuzzy search (`globalFuzzySearch`) and a vector cosine-similarity search (`/api/search/semantic`). However, they operate in silos. In modern enterprise search engines, hybrid search using **Reciprocal Rank Fusion (RRF)** is the industry best practice to merge keyword precision (lexical) with conceptual context (semantic) without requiring delicate score normalization.

This spec implements an enterprise-grade hybrid search, creating a unified `/api/search/hybrid` endpoint that returns unified results sorted by their fused RRF score.

**Impact:** Dramatically improves search relevance and user discovery of records. Documents matched by both keyword and conceptual similarity are boosted to the top automatically.

## Definition of Done

- [ ] New `globalHybridSearch` function implemented in `packages/search/src/index.ts` (or `hybrid.ts` and exported) with RRF constant `k = 60`.
- [ ] Support both PG-driver (via raw SQL / outer-joining CTEs) and standard in-memory fallback to support unit tests and local mock execution.
- [ ] New `GET /api/search/hybrid` endpoint exposed in `apps/api/src/routes/productivity.ts` under standard `tenantAuth`.
- [ ] Integration tests in `packages/testing/src/hybrid-search.test.ts` verifying:
  - (a) Lexical-only results are successfully ranked and returned.
  - (b) Semantic-only results are successfully ranked and returned.
  - (c) High-consensus results (matched by both methods) receive a boosted score.
  - (d) Strict active tenant RLS isolation is enforced (no leakages).
- [ ] `pnpm verify` and `pnpm test` green.

## Approach

### Files to create/modify
- `packages/search/src/index.ts` — implement `globalHybridSearch`
- `apps/api/src/routes/productivity.ts` — add `GET /hybrid` route and mount it
- `packages/testing/src/hybrid-search.test.ts` — create regression and verification test suite

### RRF Formula
For each unique record $d$ in the top candidate sets:
$$\text{Score}(d) = \frac{1}{60 + \text{rank}_{\text{lexical}}(d)} + \frac{1}{60 + \text{rank}_{\text{semantic}}(d)}$$
If $d$ is missing from one of the candidate lists, its rank for that list is treated as $\infty$ (so the fraction becomes 0).

## Test Strategy
- Create mock accounts and contacts in two different tenants.
- Execute hybrid searches and assert that results are correctly merged.
- Verify that a document matching both keyword (e.g. name "BigTrip Inc") and concept (e.g. "travel company") ranks higher than items matching only one of the criteria.
- Verify tenant organization boundary security.
