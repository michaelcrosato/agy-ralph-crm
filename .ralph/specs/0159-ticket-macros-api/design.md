# Task 0159: Support Ticket Canned Responses & Macros Engine - Design

## 1. Database Schema (`packages/db/src/schema.ts`)
We will add the `ticketMacros` table:
```typescript
export const ticketMacros = pgTable("ticket_macros", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  cannedResponse: text("canned_response").notNull(),
  updateStatus: text("update_status"), // "Open" | "In Progress" | "Resolved"
  updatePriority: text("update_priority"), // "Low" | "Medium" | "High" | "Urgent"
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
```

We will also update the db store structure in `packages/db/src/index.ts` to support in-memory CRUD for `ticketMacros` under active tenant RLS isolation.

## 2. Core Pure Logic (`packages/core/src/index.ts`)
We will define the input/output interfaces and a pure function to process a macro application:
```typescript
export interface TicketMacroInput {
  id: string;
  orgId: string;
  name: string;
  cannedResponse: string;
  updateStatus: string | null;
  updatePriority: string | null;
}

export interface TicketMacroApplyInput {
  ticket: {
    id: string;
    orgId: string;
    status: string;
    priority: string;
  };
  macro: TicketMacroInput;
}

export interface TicketMacroApplyResult {
  updatedStatus: string;
  updatedPriority: string;
  commentBody: string;
  auditMessage: string;
}

export function applyTicketMacro(input: TicketMacroApplyInput): TicketMacroApplyResult {
  const { ticket, macro } = input;

  if (ticket.orgId !== macro.orgId) {
    throw new Error("RLS Isolation Violation: Tenant mismatch.");
  }

  const updatedStatus = macro.updateStatus || ticket.status;
  const updatedPriority = macro.updatePriority || ticket.priority;

  return {
    updatedStatus,
    updatedPriority,
    commentBody: macro.cannedResponse,
    auditMessage: `Applied macro [${macro.name}]. Status transitioned from '${ticket.status}' to '${updatedStatus}', priority from '${ticket.priority}' to '${updatedPriority}'.`,
  };
}
```

## 3. REST API Routes (`apps/api/src/index.ts`)
- `POST /api/service/tickets/macros`
  - Body: `{ name: string, description?: string, cannedResponse: string, updateStatus?: string, updatePriority?: string }`
  - Validates `name` and `cannedResponse`.
  - Saves in db store.
- `GET /api/service/tickets/macros`
  - Queries all macros belonging to the current `orgId`.
- `POST /api/service/tickets/:id/apply-macro/:macroId`
  - Fetches the ticket and macro.
  - Verifies RLS.
  - Invokes `applyTicketMacro`.
  - Updates the ticket's priority and status in the store.
  - Adds a new ticket comment with the canned response.
  - Inserts an audit log entry.
