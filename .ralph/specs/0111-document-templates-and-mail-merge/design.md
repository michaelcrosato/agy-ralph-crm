# Specification: Document Templates & Mail Merge Engine - Design

## Database Schema (Drizzle ORM)

We will define two new structures in `packages/db/src/schema.ts`:

```typescript
export const documentTemplates = pgTable("document_templates", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull(),
  name: text("name").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const mergedDocuments = pgTable("merged_documents", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull(),
  templateId: uuid("template_id").notNull(),
  recordType: text("record_type").notNull(),
  recordId: uuid("record_id").notNull(),
  compiledContent: text("compiled_content").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
```

---

## Documents Engine Contract

In `packages/documents/src/index.ts`:

```typescript
export function compileTemplate(
  templateText: string,
  context: Record<string, unknown>
): string;
```

---

## REST Endpoints Matrix

- `POST /api/documents/templates` - Expects `{ name, content }`
- `GET /api/documents/templates` - Returns templates
- `POST /api/documents/merge` - Expects `{ templateId, recordType, recordId }`
- `GET /api/documents/merged` - Returns compiled history log
