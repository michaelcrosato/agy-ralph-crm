# Specification: Support Knowledge Base (Articles & Categories) Management Engine - Brief

## 1. Functional Objective
Customer support teams require a centralized Knowledge Base (KB) to store, organize, and publish FAQs, help articles, and technical documentation. This helps customers self-serve and empowers support agents to resolve tickets more efficiently.

This feature introduces the **Support Knowledge Base (Articles & Categories) Management Engine** for the `service-lite` module. The system will:
1. Allow tenants to organize help documentation into Categories (`kb_categories`) with a name and description.
2. Manage Articles (`kb_articles`) containing a title, body content, publishing status (`"Draft"` or `"Published"`), view count tracking, category relationship, and author ID.
3. Expose REST endpoints to create, list, and update categories and articles under strict active tenant Row-Level Security (RLS) isolation.
4. Support incrementing article view counts cleanly.
5. Generate audit trails when articles are created or updated.

## 2. Technical Scope
- **Database Schema**:
  - Add `kbCategories` and `kbArticles` tables to `packages/db/src/schema.ts` and update the database store mappings and `clear` function in `packages/db/src/index.ts`.
- **Core Pure Logic**:
  - Implement `incrementArticleViewCount` and `validateArticleStatus` in `packages/core/src/index.ts` to handle view count tracking and status boundary assertions.
- **REST Endpoints**:
  - `POST /api/service/kb/categories` - Creates a new category.
  - `GET /api/service/kb/categories` - Returns all categories for the active tenant.
  - `POST /api/service/kb/articles` - Creates a new article (supporting both draft and published status).
  - `GET /api/service/kb/articles` - Queries articles for the active tenant, supporting status and category filtering.
  - `PUT /api/service/kb/articles/:id` - Updates article fields (title, content, category, status).
  - `POST /api/service/kb/articles/:id/view` - Increments the view count of an article.
- **Tenant RLS & Security**:
  - All operations must run strictly within the active tenant's context (`orgId`). A tenant must never see, modify, or view articles or categories belonging to other organizations.
- **Verification & Integration Tests**:
  - Write integration tests inside `packages/testing/src/service-kb.test.ts` validating category creation, article publication lifecycle, view count tracking, and tenant RLS isolation.
