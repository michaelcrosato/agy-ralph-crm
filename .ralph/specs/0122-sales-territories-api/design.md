# Task 0122: Sales Territories & Account Routing Engine - Design

## 1. Database Schema Specifications

We will define two new Drizzle tables in `packages/db/src/schema.ts` and extend the mock store in `packages/db/src/index.ts`.

### 1.1 `territories` Table
```typescript
export const territories = pgTable("territories", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  isActive: integer("is_active").notNull().default(0), // 0 = inactive, 1 = active
  routingMethod: text("routing_method").notNull().default("direct"), // "direct" | "round_robin"
  lastAssignedIndex: integer("last_assigned_index").notNull().default(-1),
  criteria: jsonb("criteria").notNull(), // CriteriaCondition[]
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
```

### 1.2 `territory_members` Table
```typescript
export const territoryMembers = pgTable("territory_members", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  territoryId: uuid("territory_id")
    .notNull()
    .references(() => territories.id, { onDelete: "cascade" }),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  role: text("role").notNull().default("Primary"), // "Primary" | "Overlay"
});
```

---

## 2. Core Package Mappings (`packages/core`)

We will extend `packages/core/src/index.ts` with the following types and functions.

### 2.1 Type Definitions
```typescript
export interface TerritoryCriteriaCondition {
  field: string;
  operator: "equals" | "contains" | "greater_than" | "less_than";
  value: string;
}

export interface TerritoryInput {
  id: string;
  name: string;
  isActive: number;
  routingMethod: string;
  lastAssignedIndex: number;
  criteria: TerritoryCriteriaCondition[];
}

export interface TerritoryMemberInput {
  id: string;
  territoryId: string;
  userId: string;
  role: string;
}

export interface TerritoryMatchResult {
  matchedTerritoryId: string;
  newOwnerId: string | null;
  newLastAssignedIndex: number;
}
```

### 2.2 Core Matching Function
```typescript
export function evaluateTerritoryRouting(
  account: Record<string, unknown>,
  territories: TerritoryInput[],
  members: TerritoryMemberInput[],
): TerritoryMatchResult | null {
  // Filters active territories
  const activeTerritories = territories.filter((t) => t.isActive === 1);

  for (const territory of activeTerritories) {
    let match = true;
    for (const cond of territory.criteria) {
      let val: unknown = undefined;
      if (cond.field.startsWith("custom.")) {
        const customField = cond.field.substring("custom.".length);
        val = (account.custom as Record<string, unknown> | null)?.[customField];
      } else {
        val = account[cond.field];
      }

      if (val === undefined || val === null) {
        match = false;
        break;
      }

      const valStr = String(val).toLowerCase();
      const condStr = String(cond.value).toLowerCase();

      if (cond.operator === "equals") {
        if (valStr !== condStr) {
          match = false;
          break;
        }
      } else if (cond.operator === "contains") {
        if (!valStr.includes(condStr)) {
          match = false;
          break;
        }
      } else if (cond.operator === "greater_than") {
        const vNum = Number.parseFloat(valStr);
        const cNum = Number.parseFloat(condStr);
        if (Number.isNaN(vNum) || Number.isNaN(cNum) || vNum <= cNum) {
          match = false;
          break;
        }
      } else if (cond.operator === "less_than") {
        const vNum = Number.parseFloat(valStr);
        const cNum = Number.parseFloat(condStr);
        if (Number.isNaN(vNum) || Number.isNaN(cNum) || vNum >= cNum) {
          match = false;
          break;
        }
      } else {
        match = false;
        break;
      }
    }

    if (match) {
      // Find Primary members of this territory
      const primaryMembers = members.filter(
        (m) => m.territoryId === territory.id && m.role === "Primary"
      );

      if (primaryMembers.length === 0) {
        // No members to route to, keep matching but owner is null (no-op ownership update)
        return {
          matchedTerritoryId: territory.id,
          newOwnerId: null,
          newLastAssignedIndex: -1,
        };
      }

      if (territory.routingMethod === "direct") {
        return {
          matchedTerritoryId: territory.id,
          newOwnerId: primaryMembers[0].userId,
          newLastAssignedIndex: -1,
        };
      }

      if (territory.routingMethod === "round_robin") {
        const nextIndex = (territory.lastAssignedIndex + 1) % primaryMembers.length;
        return {
          matchedTerritoryId: territory.id,
          newOwnerId: primaryMembers[nextIndex].userId,
          newLastAssignedIndex: nextIndex,
        };
      }
    }
  }

  return null;
}
```

---

## 3. REST API Specifications (`apps/api`)

Endpoints will execute under the `tenantAuth` middleware to propagate `AsyncLocalStorage` tenant contexts.

- `POST /api/territories`
  - Body: `{ name: string, isActive?: number, routingMethod?: string, criteria: CriteriaCondition[] }`
  - Creates a new territory.
- `PUT /api/territories/:id`
  - Body: `{ name?: string, isActive?: number, routingMethod?: string, criteria?: CriteriaCondition[] }`
  - Updates an existing territory.
- `GET /api/territories`
  - Lists all territories belonging to the active tenant.
- `POST /api/territories/:id/members`
  - Body: `{ userId: string, role?: string }`
  - Associates a user with a territory.
- `DELETE /api/territories/:id/members/:userId`
  - Removes a user from a territory.
- `POST /api/accounts/:id/route`
  - Runs the evaluation on the specific account. If matched, updates the account owner, sets territory custom field, and registers an audit trail log.
