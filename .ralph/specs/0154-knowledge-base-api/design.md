# Specification: Support Knowledge Base (Articles & Categories) Management Engine - Design

## 1. Database Schema Definitions

### 1.1 Drizzle Schema (`packages/db/src/schema.ts`)
```typescript
export const kbCategories = pgTable("kb_categories", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const kbArticles = pgTable("kb_articles", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  categoryId: uuid("category_id")
    .notNull()
    .references(() => kbCategories.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  content: text("content").notNull(),
  status: text("status").notNull().default("Draft"), // "Draft" | "Published"
  viewCount: integer("view_count").notNull().default(0),
  authorId: uuid("author_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
```

### 1.2 Store Interfaces (`packages/db/src/index.ts`)
```typescript
export interface DBKbCategory {
  id: string;
  orgId: string;
  name: string;
  description: string | null;
  createdAt: Date;
}

export interface DBKbArticle {
  id: string;
  orgId: string;
  categoryId: string;
  title: string;
  content: string;
  status: "Draft" | "Published";
  viewCount: number;
  authorId: string;
  createdAt: Date;
}
```

## 2. Core Business Logic Engine (`packages/core/src/index.ts`)

### 2.1 Pure Functions
- **Article Status Validator**:
  ```typescript
  export function validateArticleStatus(status: string): boolean {
    return status === "Draft" || status === "Published";
  }
  ```
- **Article View Count Incrementor**:
  ```typescript
  export function incrementArticleViewCount(currentCount: number): number {
    if (currentCount < 0) return 0;
    return currentCount + 1;
  }
  ```

## 3. Hono API Routes (`apps/api/src/index.ts`)
- **Categories CRUD**:
  - `POST /api/service/kb/categories` - Create a category and insert audit log.
  - `GET /api/service/kb/categories` - Query current tenant's KB categories.
- **Articles CRUD**:
  - `POST /api/service/kb/articles` - Validate category, create article with `viewCount = 0` and current user as `authorId`, insert audit log.
  - `GET /api/service/kb/articles` - Query current tenant's articles with optional `categoryId` and `status` filtering.
  - `PUT /api/service/kb/articles/:id` - Fetch article, validate updates, update article, insert audit log.
  - `POST /api/service/kb/articles/:id/view` - Fetch article, call `incrementArticleViewCount`, update DB, return updated record.
