# Specification: Opportunity Products, Products & Pricebooks API - Design

## 1. Database Schema Additions (`packages/db/src/schema.ts`)

```typescript
export const products = pgTable("products", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  sku: text("sku"),
  description: text("description"),
  isActive: integer("is_active").notNull().default(1), // 1 = true, 0 = false
});

export const pricebooks = pgTable("pricebooks", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  isActive: integer("is_active").notNull().default(1),
  isStandard: integer("is_standard").notNull().default(0),
});

export const pricebookEntries = pgTable("pricebook_entries", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  pricebookId: uuid("pricebook_id").notNull().references(() => pricebooks.id, { onDelete: "cascade" }),
  productId: uuid("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  unitPrice: text("unit_price").notNull(),
  isActive: integer("is_active").notNull().default(1),
});

export const opportunityProducts = pgTable("opportunity_products", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  opportunityId: uuid("opportunity_id").notNull().references(() => opportunities.id, { onDelete: "cascade" }),
  pricebookEntryId: uuid("pricebook_entry_id").notNull().references(() => pricebookEntries.id, { onDelete: "cascade" }),
  quantity: integer("quantity").notNull(),
  unitPrice: text("unit_price").notNull(),
  totalPrice: text("total_price").notNull(),
});
```

## 2. In-Memory Mock Store Extension (`packages/db/src/index.ts`)

- Implement `DBProduct`, `DBPricebook`, `DBPricebookEntry`, `DBOpportunityProduct` interfaces.
- Extend `store` lists and mock CRUD stores under `dbStore` with strict tenancy check and RLS verification.

## 3. Core Business Logic Recalculation (`packages/core/src/index.ts`)

Pure utility to rollup prices:
```typescript
export interface LineItemInput {
  totalPrice: string;
}

export function rollupOpportunityAmount(items: LineItemInput[]): string {
  const sum = items.reduce((acc, item) => acc + (parseFloat(item.totalPrice) || 0), 0);
  return String(sum);
}
```

## 4. API Endpoint Implementations (`apps/api/src/index.ts`)

- **`POST /api/products`**: Inserts a new product under tenant RLS.
- **`GET /api/products`**: Lists all products for tenant.
- **`POST /api/pricebooks`**: Inserts a new pricebook under tenant RLS.
- **`GET /api/pricebooks`**: Lists all pricebooks for tenant.
- **`POST /api/pricebooks/entries`**: Inserts a new pricebook entry.
- **`POST /api/opportunities/:oppId/products`**:
  - Adds a line item.
  - Automatically calculates `totalPrice = quantity * unitPrice`.
  - Recalculates and updates the parent Opportunity's `amount` using `rollupOpportunityAmount`.
- **`GET /api/opportunities/:oppId/products`**: Lists all line items for the opportunity.
- **`PATCH /api/opportunities/:oppId/products/:lineItemId`**:
  - Updates line item quantity and/or unitPrice.
  - Re-calculates total line price.
  - Recalculates and updates the parent Opportunity's `amount`.
- **`DELETE /api/opportunities/:oppId/products/:lineItemId`**:
  - Removes the line item.
  - Recalculates and updates the parent Opportunity's `amount`.
