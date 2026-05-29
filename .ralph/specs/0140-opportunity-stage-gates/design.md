# Spec 0140: Opportunity Stage Gates & Validation Rules Design

## 1. Database Schema Definitions (`packages/db/src/schema.ts`)

```typescript
export const opportunityStageGates = pgTable("opportunity_stage_gates", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  targetStage: text("target_stage").notNull(),
  field: text("field").notNull(),
  operator: text("operator").notNull(),
  expectedValue: text("expected_value"),
  errorMessage: text("error_message").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
```

## 2. Mock Store Types & Interfaces (`packages/db/src/index.ts`)

```typescript
export interface DBOpportunityStageGate {
  id: string;
  orgId: string;
  targetStage: string;
  field: string;
  operator: string;
  expectedValue: string | null;
  errorMessage: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
```

Add `opportunityStageGates: [] as DBOpportunityStageGate[]` in `store` configuration and implement the CRUD actions under `dbStore.opportunityStageGates` asserting tenant context.

## 3. Core Validation Interface (`packages/core/src/index.ts`)

```typescript
export interface StageGateRule {
  targetStage: string;
  field: string;
  operator: string;
  expectedValue: string | null;
  errorMessage: string;
  isActive: boolean;
}

export function validateOpportunityStageGate(
  opportunity: Record<string, unknown>,
  rules: StageGateRule[],
  newStage: string,
): { isValid: boolean; errorMessages: string[] }
```

## 4. API Endpoint Definitions (`apps/api/src/index.ts`)

### GET `/api/stage-gates`
Returns `200 OK` with JSON array of configured stage gates for the active organization.

### POST `/api/stage-gates`
Receives:
```json
{
  "targetStage": "Closed Won",
  "field": "amount",
  "operator": "greater_than",
  "expectedValue": "0",
  "errorMessage": "Opportunity amount must be greater than zero to close won.",
  "isActive": true
}
```
Inserts or updates the stage gate. Returns `201 Created` or `200 OK`. Write audit log with event `create_stage_gate` or `update_stage_gate`.

### PATCH `/api/opportunities/:id`
1. Fetch current opportunity.
2. If `body.stage` is provided and `body.stage !== currentOpportunity.stage`:
   - Fetch active stage gates from `dbStore.opportunityStageGates.findMany()`.
   - Merge `currentOpportunity` properties with incoming patched properties.
   - Run `validateOpportunityStageGate(mergedOpp, activeRules, body.stage)`.
   - If invalid:
     - Return HTTP `400 Bad Request` with `{ success: false, errors: result.errorMessages }`.
     - Abort stage change and do not mutate database.
   - If valid, proceed with opportunity patch updates.
