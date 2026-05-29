# Specification: Support Knowledge Base (Articles & Categories) Management Engine - Requirements

## 1. Functional Requirements

### 1.1 Category Management (`kb_categories`)
- The system must allow tenants to define categories to group articles.
- A Category contains a name and description.
- Restrict Category name to be non-empty.

### 1.2 Article Management (`kb_articles`)
- The system must support creating help articles under a specific category.
- An Article must contain: `title`, `content`, `status` (`"Draft"` or `"Published"`), `viewCount` (initially `0`), `categoryId` (references a category), `authorId` (references a user).
- Status must be restricted to standard values: `"Draft"`, `"Published"`.
- Support updating an article's details (title, content, category, status).

### 1.3 Article View Tracking
- When an article is viewed/accessed, the system must allow incrementing its view count by `1`.
- View counts must be non-negative integers.

### 1.4 REST API Surface
- **Categories**:
  - `POST /api/service/kb/categories` - Payload: `{ name: string, description: string }`. Returns the created category.
  - `GET /api/service/kb/categories` - Returns all categories for the active tenant.
- **Articles**:
  - `POST /api/service/kb/articles` - Payload: `{ title: string, content: string, status: "Draft" | "Published", categoryId: string }`. Automatically assigns `authorId` to the current user, sets `viewCount = 0`, and saves the article.
  - `GET /api/service/kb/articles` - Returns articles for the tenant. Optional query params: `categoryId` and `status`.
  - `PUT /api/service/kb/articles/:id` - Payload: `{ title?: string, content?: string, status?: "Draft" | "Published", categoryId?: string }`. Updates article and returns updated record.
  - `POST /api/service/kb/articles/:id/view` - Increments `viewCount` by `1` and returns the updated article.

### 1.5 Tenant Isolation & RLS
- Every db operation must verify `orgId` tenancy via `AsyncLocalStorage` and `getActiveOrgId()`.
- Tenants must never be able to access, update, or view another tenant's categories or articles.

### 1.6 Audit Trails
- Creating a category must log an audit entry in the `auditLogs` table.
- Creating/updating an article must log an audit entry in the `auditLogs` table, detailing status changes.

## 2. Technical Constraints
- Pure logic functions in `packages/core` must be fully type-safe.
- TypeScript type-checking must pass cleanly with zero warnings or `any` workarounds.
- Lint and formatting must pass Biome checks.
