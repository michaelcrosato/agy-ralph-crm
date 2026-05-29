# Specification: Support Knowledge Base (Articles & Categories) Management Engine - Implementation Plan

## 1. Schema Modifications
- Open `packages/db/src/schema.ts` and add definitions for `kbCategories` and `kbArticles`.
- Open `packages/db/src/index.ts` and:
  - Add `DBKbCategory` and `DBKbArticle` interfaces.
  - Register `kbCategories` and `kbArticles` inside the `store` object and the `clear` function.
  - Implement CRUD helpers (`findMany`, `findOne`, `insert`, `update`) for `kbCategories` and `kbArticles` inside `dbStore` enforcing active tenant RLS bounds.

## 2. Core Library Implementation
- Open `packages/core/src/index.ts` and implement pure functions `validateArticleStatus` and `incrementArticleViewCount`.
- Export these functions from `packages/core/src/index.ts`.

## 3. Hono API Routes
- Open `apps/api/src/index.ts`.
- Implement endpoints:
  - `POST /api/service/kb/categories`
  - `GET /api/service/kb/categories`
  - `POST /api/service/kb/articles`
  - `GET /api/service/kb/articles`
  - `PUT /api/service/kb/articles/:id`
  - `POST /api/service/kb/articles/:id/view`
- Ensure all operations write detailed audit trails.

## 4. Test Suite Configuration
- Create `packages/testing/src/service-kb.test.ts`.
- Write thorough integration tests confirming category creation, article lifecycle transitions, views increment logic, and absolute tenant RLS boundaries.
