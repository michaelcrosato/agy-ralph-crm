# Specification: Opportunity Product Schedules API - Design

## 1. Database Schema Extensions (`packages/db/src/schema.ts`)
We will define the new table `opportunityProductSchedules`:
```typescript
export const opportunityProductSchedules = pgTable("opportunity_product_schedules", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  opportunityProductId: uuid("opportunity_product_id")
    .notNull()
    .references(() => opportunityProducts.id, { onDelete: "cascade" }),
  scheduleType: text("schedule_type").notNull(), // "revenue" | "quantity"
  scheduleDate: timestamp("schedule_date").notNull(),
  amount: text("amount").notNull(), // revenue decimal or quantity string
  description: text("description"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
```

## 2. API Endpoints (`apps/api/src/index.ts`)
- `GET /api/opportunities/:id/products/:productId/schedules`
  - Returns `{ success: true, data: DBOpportunityProductSchedule[] }` under active tenant auth.
- `POST /api/opportunities/:id/products/:productId/schedules`
  - Body: `{ scheduleType: "revenue" | "quantity", scheduleDate: string, amount: string, description?: string }`
  - Validates and creates a new schedule, returning 201 Created.
- `DELETE /api/opportunities/:id/products/:productId/schedules/:scheduleId`
  - Deletes the specified schedule, returning 200 OK.
- `POST /api/opportunities/:id/products/:productId/schedules/generate`
  - Body: `{ periodsCount: number, startDate: string }`
  - Automatically splits the product line item's price/quantity evenly over `periodsCount` monthly intervals.

## 3. Pure Logic Seams (`packages/core/src/index.ts`)
- `validateOpportunityProductSchedule(input: Omit<DBOpportunityProductSchedule, "id" | "orgId" | "createdAt">): { success: boolean, error?: string }`
- `generateStraightLineSchedules(totalAmount: string, totalQuantity: number, type: "revenue" | "quantity", periodsCount: number, startDate: Date): Omit<DBOpportunityProductSchedule, "id" | "orgId" | "createdAt">[]`
