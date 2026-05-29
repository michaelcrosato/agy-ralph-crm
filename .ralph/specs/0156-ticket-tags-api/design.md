# Specification: Support Ticket Tags & Categorization Engine - Design

## 1. Database Schema Definitions

### 1.1 Drizzle Schema (`packages/db/src/schema.ts`)
```typescript
export const ticketTags = pgTable("ticket_tags", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  color: text("color").notNull().default("#808080"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const ticketTagLinks = pgTable("ticket_tag_links", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  ticketId: uuid("ticket_id")
    .notNull()
    .references(() => tickets.id, { onDelete: "cascade" }),
  tagId: uuid("tag_id")
    .notNull()
    .references(() => ticketTags.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
```

### 1.2 Store Interfaces (`packages/db/src/index.ts`)
```typescript
export interface DBTicketTag {
  id: string;
  orgId: string;
  name: string;
  color: string;
  createdAt: Date;
}

export interface DBTicketTagLink {
  id: string;
  orgId: string;
  ticketId: string;
  tagId: string;
  createdAt: Date;
}
```

## 2. Core Business Logic Engine (`packages/core/src/index.ts`)

### 2.1 Pure Functions
- **Ticket Tag Input Validator**:
  ```typescript
  export interface TicketTagInput {
    name: string;
    color: string;
  }

  export function validateTicketTagInput(input: TicketTagInput): {
    success: boolean;
    error?: string;
  } {
    if (!input.name || input.name.trim() === "") {
      return { success: false, error: "Tag name cannot be empty." };
    }
    if (input.name.length > 50) {
      return { success: false, error: "Tag name cannot exceed 50 characters." };
    }
    // Validate hex color (e.g. #FF0000)
    const hexPattern = /^#[0-9A-Fa-f]{6}$/;
    if (!input.color || !hexPattern.test(input.color)) {
      return { success: false, error: "Tag color must be a valid 6-character hex color starting with '#'." };
    }
    return { success: true };
  }
  ```

## 3. Hono API Routes (`apps/api/src/index.ts`)
- **Ticket Tags Endpoints**:
  - `POST /api/service/tags`:
    - Validates inputs using `validateTicketTagInput`.
    - Check duplicate tag name under active tenant. Return 400 if already exists.
    - Create tag and insert audit log.
  - `GET /api/service/tags`:
    - List all tags for the active tenant.
  - `POST /api/service/tickets/:id/tags`:
    - Check if ticket exists under active tenant. Return 404 if not found.
    - Check if tag exists under active tenant. Return 404 if not found.
    - Check if tag link already exists. If yes, return success idempotently.
    - Link tag to ticket, insert audit log.
  - `DELETE /api/service/tickets/:id/tags/:tagId`:
    - Check if ticket exists under active tenant. Return 404 if not found.
    - Find and delete the link. Return 200. Insert audit log.
  - `GET /api/service/tickets/:id/tags`:
    - Check if ticket exists under active tenant. Return 404 if not found.
    - Fetch and return all tags linked to the ticket.
