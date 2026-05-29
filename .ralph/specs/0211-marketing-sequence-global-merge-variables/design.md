# Specification: Marketing Sequence Global Merge Variables - Design

## 1. Database Schema (`packages/db/src/schema.ts`)
```typescript
export const marketingSequenceGlobalVariables = pgTable(
  "marketing_sequence_global_variables",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    value: text("value").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
);
```

## 2. In-Memory Store Type (`packages/db/src/index.ts`)
```typescript
export interface DBMarketingSequenceGlobalVariable {
  id: string;
  orgId: string;
  key: string;
  value: string;
  createdAt: Date;
  updatedAt: Date;
}
```

The database store should expose:
- `findMany()`: Fetches all variables for the active tenant.
- `findOne(id)`: Fetches a single variable under RLS.
- `insert(item)`: Inserts or updates a global variable under RLS.
- `delete(id)`: Removes a variable under RLS.

## 3. Template Compiler Engine (`packages/core/src/index.ts`)
Update `personalizeEmailTemplate` signature or execution:
```typescript
export function personalizeEmailTemplate(
  template: EmailTemplateInput,
  context: {
    lead?: Record<string, unknown> | null;
    account?: Record<string, unknown> | null;
    contact?: Record<string, unknown> | null;
    opportunity?: Record<string, unknown> | null;
    globalVariables?: Record<string, string> | null;
  },
): { subject: string; body: string }
```

In the placeholder resolution inside `personalizeEmailTemplate`:
1. Check if the parsed object name is `"global"`.
2. If so, resolve the field using `context.globalVariables` using the field name key (e.g. `companyName`).
3. Apply filters as usual.

## 4. REST Endpoint API (`apps/api/src/index.ts`)
Expose:
- `GET /api/sequences/settings/variables` -> returns `{ success: true, data: variables }`
- `POST /api/sequences/settings/variables` -> accepts `{ key, value }`, returns `{ success: true, data: variable }`
- `DELETE /api/sequences/settings/variables/:id` -> returns `{ success: true, message: "Global variable deleted" }`
