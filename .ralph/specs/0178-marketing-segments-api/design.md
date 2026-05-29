# Specification: Marketing Segments & Dynamic Lists API - Design

## 1. Schema Extensions & Interfaces

We declare the new entities in `packages/db/src/schema.ts` and `packages/db/src/index.ts`:

### Postgres / Drizzle Schema (`packages/db/src/schema.ts`)
```typescript
export const marketingSegments = pgTable("marketing_segments", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  objectType: text("object_type").notNull(), // "lead" | "contact"
  criteria: jsonb("criteria").notNull(), // CriteriaCondition[]
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
```

### In-Memory Interfaces (`packages/db/src/index.ts`)
We expose local typings `DBMarketingSegment` matching properties exactly.
We mount `marketingSegments` in the internal `store` array and build RLS-isolated CRUD interfaces on `dbStore`.

## 2. Dynamic Evaluation Logic (`packages/core/src/index.ts`)

We implement the pure evaluation function:
```typescript
export function evaluateSegmentCriteria(
  record: Record<string, unknown>,
  criteria: CriteriaCondition[],
): boolean {
  for (const cond of criteria) {
    let val: unknown = undefined;
    if (cond.field.startsWith("custom.")) {
      const customField = cond.field.substring("custom.".length);
      val = (record.custom as Record<string, unknown> | null)?.[customField];
    } else {
      val = record[cond.field];
    }

    if (val === undefined || val === null) {
      return false;
    }

    const valStr = String(val).toLowerCase();
    const condStr = String(cond.value).toLowerCase();

    if (cond.operator === "equals") {
      if (valStr !== condStr) return false;
    } else if (cond.operator === "not_equal") {
      if (valStr === condStr) return false;
    } else if (cond.operator === "contains") {
      if (!valStr.includes(condStr)) return false;
    } else if (cond.operator === "greater_than") {
      const vNum = Number.parseFloat(valStr);
      const cNum = Number.parseFloat(condStr);
      if (Number.isNaN(vNum) || Number.isNaN(cNum) || vNum <= cNum) return false;
    } else if (cond.operator === "less_than") {
      const vNum = Number.parseFloat(valStr);
      const cNum = Number.parseFloat(condStr);
      if (Number.isNaN(vNum) || Number.isNaN(cNum) || vNum >= cNum) return false;
    } else {
      return false;
    }
  }
  return true;
}
```

We implement the resolver:
```typescript
export async function resolveSegmentMembers(
  db: any,
  tenantOrgId: string,
  segmentId: string,
): Promise<any[]> {
  const segment = await db.marketingSegments.findOne(segmentId);
  if (!segment) {
    throw new Error("Segment not found");
  }

  if (segment.objectType === "lead") {
    const leads = await db.leads.findMany();
    return leads.filter((l: any) => evaluateSegmentCriteria(l, segment.criteria));
  } else {
    const contacts = await db.contacts.findMany();
    return contacts.filter((c: any) => evaluateSegmentCriteria(c, segment.criteria));
  }
}
```

## 3. REST API Endpoints

- **POST `/api/segments`**
  - Payload: `{ name, description, objectType, criteria }`
- **GET `/api/segments`**
  - Returns list of segments for active tenant.
- **GET `/api/segments/:id`**
  - Returns specific segment metadata details.
- **DELETE `/api/segments/:id`**
  - Deletes segment.
- **GET `/api/segments/:id/members`**
  - Returns list of dynamically resolved matching Lead/Contact records.
