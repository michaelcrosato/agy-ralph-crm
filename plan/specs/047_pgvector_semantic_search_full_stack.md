# 047 — pgvector + embeddings on Accounts/Contacts for semantic search (Full-Stack)

**Phase:** 2 (Replenish) · **Priority:** Medium · **Status:** `[x] Completed` · **Depends on:** 013, 036

## Description & Expected Impact

To deliver a state-of-the-art 2026 CRM semantic search surface, we will integrate `pgvector` persistence on top of the `@crm/search` package. This specification brings full-stack capability to Spec 036:
1. **Postgres RLS + pgvector Table**: Establish the physical `embeddings` table with pgvector(1536), tenant RLS, and an HNSW performance index.
2. **Background Embedder Worker**: An in-memory queue-based worker that listens to Contact and Account mutations and asynchronously generates embeddings.
3. **Semantic REST API**: Endpoint `GET /api/search/semantic` performing cosine-similarity searches utilizing Postgres native distance operators on real PG driver, and local ranking as fallback on mock driver.

## Definition of Done & Acceptance Criteria

- [ ] **Database Schema & Migrations (`packages/db/src/schema.ts`)**:
  - Enable `pgvector` extension via Drizzle migration.
  - Declare `embeddings` table with columns: `id`, `orgId` (referencing `organizations.id`), `entityType` (text), `entityId` (text), `embedding` (vector(1536)), and `createdAt` (timestamp).
  - Add indexes: a composite index on `(orgId, entityType, entityId)` and an HNSW index on `embedding` using `vector_cosine_ops`.
- [ ] **Mock Stores & PG Mappings (`packages/db/src/`)**:
  - Add `DBEmbedding` interface and add the corresponding array `embeddings` to the `store` object in `packages/db/src/_store.ts`.
  - Create mock store file `packages/db/src/stores/embeddings.ts`.
  - Register it in `mockStores` (`packages/db/src/stores/index.ts`) and `storeMetadata` (`packages/db/src/stores/pg-factory.ts` with prefix `"embed"`).
- [ ] **Background Embedder Service (`packages/core/src/domain/embeddings/embedder.ts`)**:
  - Implement a queue-based `EmbedderService` to buffer account/contact insert/update triggers.
  - Formulate string representations of entities for embeddings generation (e.g. name + domain/email).
  - Automatically hook the store `insert` and `update` methods for Accounts and Contacts to enqueue tasks.
  - Support env `EMBEDDINGS_PROVIDER=openai|mock` defaulting to `mock` using `createMockEmbeddingProvider(1536)`.
- [ ] **REST Route (`apps/api/src/routes/productivity.ts`)**:
  - Add endpoint `GET /api/search/semantic` (requires query parameter `q` and optional `entity` filter like `account` or `contact`).
  - Scoped strictly to active tenant with RLS context.
  - Returns ranked list of candidate accounts/contacts.
- [ ] **Integration Tests (`packages/testing/src/semantic-search-full-stack.test.ts`)**:
  - Seed Accounts & Contacts for `org-a` and `org-b`.
  - Verify semantic search ranks relevant candidates first.
  - Assert multi-tenant RLS isolation: Tenant B cannot see Tenant A's semantic search results or query Tenant A's embeddings.

## Test Strategy

- **Test Suite**: `packages/testing/src/semantic-search-full-stack.test.ts`
  - Runs against both `mock` and `postgres` backends.
  - Verifies that inserting accounts/contacts generates matching embeddings in the database.
  - Verifies `/api/search/semantic` endpoint with correct result ranking and strict organization tenant RLS boundaries.
