# Specification: Sales Commission Calculation & Attainment Tracking - Design

## 1. Core Domain Interfaces & Logic (`packages/core`)

### 1.1 Interfaces
```typescript
export interface CommissionCalculationInput {
  opportunityAmount: string;
  opportunityStage: string;
  quotaTarget: string | null;
  currentClosedWonTotal: string; // Closed Won opportunities total excluding the current one
  baseRate?: string;             // Default "0.05" (5%)
}

export interface CommissionResult {
  commissionAmount: string;
  attainmentPercentage: number;
  rateApplied: string;
  multiplierApplied: number;
}
```

### 1.2 Pure Function
```typescript
export function calculateOpportunityCommission(
  input: CommissionCalculationInput
): CommissionResult;
```
*Algorithm:*
1. If `opportunityStage !== "Closed Won"`, return all amounts/percentages as `"0.00"` / `0`.
2. Compute `amount = parseFloat(opportunityAmount)`.
3. Compute `quota = quotaTarget ? parseFloat(quotaTarget) : 0`.
4. Compute `priorTotal = parseFloat(currentClosedWonTotal)`.
5. Compute `newTotal = priorTotal + amount`.
6. Compute `base = input.baseRate ? parseFloat(input.baseRate) : 0.05`.
7. Compute `attainmentPercentage = quota > 0 ? (newTotal / quota) * 100 : 0`.
8. Determine multiplier:
   - If `attainmentPercentage >= 150`, multiplier is `1.5`
   - Else if `attainmentPercentage >= 100`, multiplier is `1.2`
   - Else, multiplier is `1.0`
9. Effective rate: `base * multiplier`.
10. Commission: `amount * effectiveRate`.
11. Return rounded string representations for rates and amounts.

## 2. Database Schema (`packages/db`)

### 2.1 Table Schema Definition (`schema.ts`)
```typescript
export const commissions = pgTable("commissions", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  opportunityId: uuid("opportunity_id")
    .notNull()
    .references(() => opportunities.id, { onDelete: "cascade" }),
  amount: text("amount").notNull(),
  rateApplied: text("rate_applied").notNull(),
  status: text("status").notNull().default("Pending"), // "Pending" | "Approved" | "Paid"
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
```

### 2.2 Store Extension (`index.ts`)
```typescript
export interface DBCommission {
  id: string;
  orgId: string;
  userId: string;
  opportunityId: string;
  amount: string;
  rateApplied: string;
  status: "Pending" | "Approved" | "Paid";
  createdAt: Date;
}
```
Extend `store.commissions = [] as DBCommission[]` and `dbStore.commissions` standard accessors with RLS isolation.

## 3. REST API Routes (`apps/api`)

### 3.1 `POST /api/commissions/calculate`
- Protected by `tenantAuth`.
- Body: `{ opportunityId: string, baseRate?: string }`.
- Logic:
  1. Fetch opportunity by ID. Return 404 if not found or Tenant mismatch.
  2. Verify opportunity stage is "Closed Won". If not, return `400` ("Commission can only be calculated for Closed Won opportunities").
  3. Check if a commission record already exists for `opportunityId`. Return `400` if it exists.
  4. Formulate the close date period `"YYYY-MM"` from opportunity `closeDate` (or default to current month).
  5. Fetch quotas for the opportunity owner in that period.
  6. Fetch all Closed Won opportunities for the same owner in the same period (excluding the current one) and sum their amounts.
  7. Compute commission using `calculateOpportunityCommission`.
  8. Save new commission into `commissions` table.
  9. Save audit log for `action: "calculate"`.
  10. Return success and the saved commission object.

### 3.2 `GET /api/commissions`
- Protected by `tenantAuth`.
- Returns commissions list matching the active tenant.

### 3.3 `POST /api/commissions/:id/approve`
- Protected by `tenantAuth`.
- Logic:
  1. Fetch commission by ID. Return `404` if not found.
  2. Update status to `"Approved"`.
  3. Save audit log for `action: "approve"`.
  4. Return success and updated commission.
