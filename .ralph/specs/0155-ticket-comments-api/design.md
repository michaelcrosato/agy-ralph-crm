# Specification: Support Ticket Comments & Replies Management Engine - Design

## 1. Database Schema Definitions

### 1.1 Drizzle Schema (`packages/db/src/schema.ts`)
```typescript
export const ticketComments = pgTable("ticket_comments", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  ticketId: uuid("ticket_id")
    .notNull()
    .references(() => tickets.id, { onDelete: "cascade" }),
  authorId: uuid("author_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  body: text("body").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
```

### 1.2 Store Interfaces (`packages/db/src/index.ts`)
```typescript
export interface DBTicketComment {
  id: string;
  orgId: string;
  ticketId: string;
  authorId: string;
  body: string;
  createdAt: Date;
}
```

## 2. Core Business Logic Engine (`packages/core/src/index.ts`)

### 2.1 Pure Functions
- **Comment Input Validator**:
  ```typescript
  export interface TicketCommentInput {
    body: string;
  }

  export function validateTicketCommentInput(input: TicketCommentInput): {
    success: boolean;
    error?: string;
  } {
    if (!input.body || input.body.trim() === "") {
      return { success: false, error: "Comment body cannot be empty." };
    }
    return { success: true };
  }
  ```

## 3. Hono API Routes (`apps/api/src/index.ts`)
- **Ticket Comments Endpoints**:
  - `POST /api/service/tickets/:id/comments`:
    - Check if ticket exists under active tenant. Return 404 if not found.
    - Validate comment body using `validateTicketCommentInput`.
    - Create comment and insert audit log.
  - `GET /api/service/tickets/:id/comments`:
    - Check if ticket exists under active tenant. Return 404 if not found.
    - Query and return comments for the ticket, sorted by `createdAt` ascending.
