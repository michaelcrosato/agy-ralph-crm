# Specification: Email HTML Templates & Merge Fields Engine API - Design

## 1. Database Schema Design

We will add a new table `email_templates` in `packages/db/src/schema.ts` to store custom email templates:

```typescript
export const emailTemplates = pgTable("email_templates", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  subject: text("subject").notNull(),
  body: text("body").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
```

We will also update `packages/db/src/index.ts` to export:
- `DBEmailTemplate` interface.
- `store.emailTemplates` in-memory database array.
- `dbStore.emailTemplates` wrapper for CRUD operations.

## 2. Core Business Logic Design

We will implement a `compileEmailTemplate` helper in `packages/core/src/index.ts`:

```typescript
export interface EmailTemplateInput {
  subject: string;
  body: string;
}

export function compileEmailTemplate(
  template: EmailTemplateInput,
  context: {
    lead?: Record<string, unknown> | null;
    account?: Record<string, unknown> | null;
    contact?: Record<string, unknown> | null;
    opportunity?: Record<string, unknown> | null;
  },
): { subject: string; body: string }
```

### Placeholders Regex & Resolution Logic:
- Use a regular expression like `/\{\{([A-Za-z0-9.]+)\}\}/g` to identify merge placeholders.
- Split the path by `.` (e.g. `Lead.firstName`, `Lead.custom.score`).
- Map the object name (`Lead`, `Contact`, `Account`, `Opportunity`) case-insensitively to the context keys.
- If the second part is `custom`, look inside the `custom` JSONB property for the field value. Otherwise, look for the field directly on the record.
- Replace placeholders with the stringified field value, or empty string `""` if unresolved/null.

## 3. REST API Routes Design

We will add the following routes in `apps/api/src/index.ts`:

### Metadata CRUD:
- `POST /api/metadata/email-templates` - Creates an email template. Enforces active tenant context.
- `GET /api/metadata/email-templates` - Lists email templates for active tenant context.
- `DELETE /api/metadata/email-templates/:id` - Deletes a template. Enforces active tenant context.

### Template Compilation Endpoint:
- `POST /api/metadata/email-templates/:id/compile` - Loads corresponding records (Lead, Contact, Account, Opportunity) by their ID using active tenant context. Constructs the compilation context, calls `compileEmailTemplate`, and returns compiled subject and body.
