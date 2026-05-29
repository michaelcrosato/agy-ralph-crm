# Specification: Dependent Picklists & Field Value Matrix API - Design

## 1. Database Schema (`packages/db/src/schema.ts`)

```typescript
export const picklistDependencies = pgTable("picklist_dependencies", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  objectType: text("object_type").notNull(), // "leads" | "accounts" | "contacts" | "opportunities"
  parentField: text("parent_field").notNull(),
  dependentField: text("dependent_field").notNull(),
  dependencyMap: jsonb("dependency_map").notNull(), // Record<string, string[]>
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
```

## 2. In-Memory Store (`packages/db/src/index.ts`)

Add the typescript interface and list storage:
```typescript
export interface DBPicklistDependency {
  id: string;
  orgId: string;
  objectType: string;
  parentField: string;
  dependentField: string;
  dependencyMap: Record<string, string[]>;
  createdAt: Date;
  updatedAt: Date;
}
```

Add `picklistDependencies: [] as DBPicklistDependency[]` to the `store` object.
Equip `dbStore` with a `picklistDependencies` controller wrapper:
```typescript
  picklistDependencies: {
    findMany: async () => {
      const orgId = getActiveOrgId();
      return store.picklistDependencies.filter((d) => d.orgId === orgId);
    },
    findOne: async (id: string) => {
      const orgId = getActiveOrgId();
      const d = store.picklistDependencies.find((x) => x.id === id);
      if (d && d.orgId !== orgId) return null;
      return d || null;
    },
    insert: async (d: Omit<DBPicklistDependency, "id" | "createdAt" | "updatedAt">) => {
      const orgId = getActiveOrgId();
      if (d.orgId !== orgId) {
        throw new Error("RLS Isolation Violation: Tenant mismatch.");
      }
      const newDep: DBPicklistDependency = {
        ...d,
        id: `pldep-${Math.random().toString(36).substring(2, 11)}`,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      store.picklistDependencies.push(newDep);
      return newDep;
    },
    update: async (id: string, updates: Partial<Omit<DBPicklistDependency, "id" | "orgId" | "createdAt" | "updatedAt">>) => {
      const orgId = getActiveOrgId();
      const index = store.picklistDependencies.findIndex((x) => x.id === id);
      if (index === -1) return null;
      if (store.picklistDependencies[index].orgId !== orgId) {
        throw new Error("RLS Isolation Violation: Tenant mismatch.");
      }
      store.picklistDependencies[index] = {
        ...store.picklistDependencies[index],
        ...updates,
        updatedAt: new Date(),
      };
      return store.picklistDependencies[index];
    },
    delete: async (id: string) => {
      const orgId = getActiveOrgId();
      const index = store.picklistDependencies.findIndex((x) => x.id === id);
      if (index === -1) return false;
      if (store.picklistDependencies[index].orgId !== orgId) {
        throw new Error("RLS Isolation Violation: Tenant mismatch.");
      }
      store.picklistDependencies.splice(index, 1);
      return true;
    },
  },
```

## 3. Core Logic Engine (`packages/core/src/index.ts`)

Implement a validation function:
```typescript
export function validatePicklistDependencies(
  fields: Record<string, unknown>,
  dependencies: {
    parentField: string;
    dependentField: string;
    dependencyMap: Record<string, string[]>;
  }[]
): { success: boolean; error?: string } {
  for (const dep of dependencies) {
    const parentVal = fields[dep.parentField];
    const dependentVal = fields[dep.dependentField];

    // If controlling or dependent values are not set on the record mutation, skip validation
    if (parentVal === undefined || parentVal === null || dependentVal === undefined || dependentVal === null) {
      continue;
    }

    const parentValStr = String(parentVal);
    const dependentValStr = String(dependentVal);

    const allowedOptions = dep.dependencyMap[parentValStr];
    if (!allowedOptions || !allowedOptions.includes(dependentValStr)) {
      return {
        success: false,
        error: `Value '${dependentValStr}' is not allowed for dependent field '${dep.dependentField}' when parent field '${dep.parentField}' is '${parentValStr}'. Allowed values are: ${allowedOptions ? allowedOptions.join(", ") : "none"}.`,
      };
    }
  }

  return { success: true };
}
```

## 4. Hono REST API Routes (`apps/api/src/index.ts`)
- `GET /api/metadata/picklist-dependencies`: Fetches rules for the active tenant.
- `POST /api/metadata/picklist-dependencies`: Saves a new rule.
- `DELETE /api/metadata/picklist-dependencies/:id`: Deletes a rule.

Add validation interceptors directly in record insertion and updates for Lead, Account, Contact, and Opportunity inside `apps/api/src/index.ts` to query `dbStore.picklistDependencies.findMany()` and call `validatePicklistDependencies` core helper!
