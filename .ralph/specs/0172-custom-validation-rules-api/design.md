# Specification: Custom Validation Rules Engine API - Design

## 1. Database Schema Design

We will add a new table `validation_rules` in `packages/db/src/schema.ts` to store custom validation rules defined by tenants:

```typescript
export const validationRules = pgTable("validation_rules", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  objectType: text("object_type").notNull(), // "leads" | "accounts" | "contacts" | "opportunities"
  errorMessage: text("error_message").notNull(),
  criteria: jsonb("criteria").notNull(), // CriteriaCondition[] representing the error condition
  isActive: integer("is_active").notNull().default(1), // 0 = inactive, 1 = active
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
```

We will also update `packages/db/src/index.ts` to export:
- `DBValidationRule` interface.
- `store.validationRules` in-memory database array.
- `dbStore.validationRules` wrapper for CRUD operations.

## 2. Core Business Logic Design

We will implement a `validateCustomValidationRules` helper in `packages/core/src/index.ts`:

```typescript
export interface ValidationRuleInput {
  id: string;
  orgId: string;
  name: string;
  objectType: string;
  errorMessage: string;
  criteria: {
    field: string;
    operator: "equals" | "not_equal" | "contains" | "greater_than" | "less_than";
    value: string;
  }[];
  isActive: number;
}

export function validateCustomValidationRules(
  record: Record<string, unknown>,
  rules: ValidationRuleInput[],
): { success: boolean; error?: string }
```

### Evaluation Logic:
- For each active rule, check if all conditions in `criteria` evaluate to `true`.
- If they do, the error condition has been met, so validation fails, returning `{ success: false, error: rule.errorMessage }`.
- If no rules fail, return `{ success: true }`.

## 3. REST API Routes Design

We will add the following routes in `apps/api/src/index.ts`:

### Metadata Rules CRUD:
- `POST /api/metadata/validation-rules` - Creates a validation rule. Enforces tenant context on creation.
- `GET /api/metadata/validation-rules` - Retrieves all validation rules matching the tenant context.
- `DELETE /api/metadata/validation-rules/:id` - Deletes a validation rule. Enforces tenant context.

### Interceptor Validation:
- For Lead, Account, Contact, and Opportunity creations (`POST`) and mutations (`PATCH`), intercept the request:
  - Load all active validation rules matching the `objectType` and active tenant context.
  - Construct a combined record object (top-level properties + custom JSONB fields).
  - Run `validateCustomValidationRules`.
  - If validation fails, abort with `400 Bad Request` and return `{ error: rule.errorMessage }`.
