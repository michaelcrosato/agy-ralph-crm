# Spec 0141: Sales Path Guidance API Design

## 1. Database Schema Definitions (`packages/db/src/schema.ts`)

```typescript
export const stageGuidance = pgTable("stage_guidance", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  objectType: text("object_type").notNull(), // "opportunities" | "leads"
  stage: text("stage").notNull(),
  keyFields: jsonb("key_fields").notNull(), // string[] (array of field names)
  guidanceText: text("guidance_text").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
```

## 2. Core Business Logic Types & Interface (`packages/core/src/index.ts`)

```typescript
export function validateStageGuidanceKeyFields(
  record: Record<string, unknown>,
  keyFields: string[],
): {
  isClean: boolean;
  missingFields: string[];
} {
  const missingFields: string[] = [];

  for (const field of keyFields) {
    let value: unknown = undefined;

    if (field.startsWith("custom.")) {
      const fieldKey = field.substring("custom.".length);
      value = (record.custom as Record<string, unknown> | null)?.[fieldKey];
    } else {
      value = record[field];
    }

    const isEmpty =
      value === undefined ||
      value === null ||
      (typeof value === "string" && value.trim() === "");

    if (isEmpty) {
      missingFields.push(field);
    }
  }

  return {
    isClean: missingFields.length === 0,
    missingFields,
  };
}
```

## 3. API REST Endpoint Paths (`apps/api/src/index.ts`)

### `GET /api/stage-guidance`
- Fetches all stage guidance rules for the tenant.
- Middleware: `tenantAuth`.
- Returns: `200 OK` with `{ success: true, data: DBStageGuidance[] }`.

### `GET /api/stage-guidance/:objectType/:stage`
- Fetches the active stage guidance and key fields rules for the specific object type and stage.
- Middleware: `tenantAuth`.
- Returns: `200 OK` with `{ success: true, data: DBStageGuidance | null }`.

### `POST /api/stage-guidance`
- Creates a new or updates an existing stage guidance rule.
- Middleware: `tenantAuth`.
- Payload structure:
  ```json
  {
    "id": "optional-uuid",
    "objectType": "opportunities",
    "stage": "Qualification",
    "keyFields": ["amount", "closeDate"],
    "guidanceText": "Always ask about the budget and closing expectations.",
    "isActive": true
  }
  ```
- Action: Insert or update, record an audit log, and return `200 OK` (update) or `201 Created` (insert) with `{ success: true, data: DBStageGuidance }`.
