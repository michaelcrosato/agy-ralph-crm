# Spec 0129: Sales Contracts & Account Renewals Design

## 1. Database Schema Mappings (`packages/db/src/schema.ts`)

```typescript
export const contracts = pgTable("contracts", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  accountId: uuid("account_id")
    .notNull()
    .references(() => accounts.id, { onDelete: "cascade" }),
  opportunityId: uuid("opportunity_id")
    .references(() => opportunities.id, { onDelete: "set null" }),
  contractAmount: text("contract_amount").notNull().default("0.00"),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date").notNull(),
  status: text("status").notNull().default("Draft"), // "Draft" | "Active" | "Expired" | "Renewed"
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
```

## 2. Store Interfaces (`packages/db/src/index.ts`)

```typescript
export interface DBContract {
  id: string;
  orgId: string;
  accountId: string;
  opportunityId: string | null;
  contractAmount: string;
  startDate: Date;
  endDate: Date;
  status: "Draft" | "Active" | "Expired" | "Renewed";
  createdAt: Date;
}
```

Add standard tenant-isolated CRUD interfaces for `contracts` under `dbStore`.

## 3. Core Calculations & Business Logic Contracts (`packages/core/src/index.ts`)

```typescript
export interface ContractRecord {
  id: string;
  orgId: string;
  accountId: string;
  contractAmount: string;
  startDate: Date;
  endDate: Date;
  status: string;
}

export interface RenewalGenerationInput {
  contract: ContractRecord;
  accountName: string;
  escalationPercentage?: number; // defaults to 5
}

export interface GeneratedRenewalOpportunity {
  orgId: string;
  accountId: string;
  name: string;
  stage: string;
  amount: string;
  closeDate: Date;
}

/**
 * Calculates renewal contract value based on escalation markup percentage.
 */
export function calculateContractRenewalAmount(
  baseAmount: string,
  escalationPercentage = 5,
): string {
  const amount = Number.parseFloat(baseAmount) || 0;
  const markup = 1 + escalationPercentage / 100;
  return (amount * markup).toFixed(2);
}

/**
 * Checks if active contract end date is within renewal window of days (e.g. 90 days).
 */
export function isContractInRenewalWindow(
  contract: { status: string; endDate: Date },
  daysBeforeExpiration = 90,
  referenceDate = new Date(),
): boolean {
  if (contract.status !== "Active") return false;
  const diffTime = contract.endDate.getTime() - referenceDate.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays >= 0 && diffDays <= daysBeforeExpiration;
}

/**
 * Maps a contract record into the renewal sales opportunity parameters.
 */
export function generateRenewalOpportunity(
  input: RenewalGenerationInput,
): GeneratedRenewalOpportunity {
  const { contract, accountName, escalationPercentage = 5 } = input;
  const newAmount = calculateContractRenewalAmount(
    contract.contractAmount,
    escalationPercentage,
  );
  
  const endFormatted = contract.endDate.toISOString().split("T")[0];
  const name = `Renewal - ${accountName} - ${endFormatted}`;

  return {
    orgId: contract.orgId,
    accountId: contract.accountId,
    name,
    stage: "Qualification",
    amount: newAmount,
    closeDate: contract.endDate,
  };
}
```

## 4. API Endpoints (`apps/api/src/index.ts`)

* `GET /api/accounts/:id/contracts`
  - Validates account ownership
  - Returns tenant-isolated list of contract records
* `POST /api/contracts`
  - Validates account exists in the current tenant org
  - Inserts new contract, defaulting status to "Draft"
  - Generates audit trail and triggers webhook `contract.created`
* `PATCH /api/contracts/:id`
  - Retrieves contract (verifies tenant context)
  - Updates contract parameters
  - Logs audit trail changes and fires `contract.updated`
* `DELETE /api/contracts/:id`
  - Verifies tenant ownership
  - Removes contract record
  - Fires webhook `contract.deleted` / logs audit trail
* `POST /api/contracts/:id/renew`
  - Verifies contract status is `Active`
  - Calculates escalation amount and renewal close date
  - Inserts new Opportunity under the account
  - Updates contract status to `Renewed`
  - Logs audit trail, fires `contract.renewed` webhook, returns new opportunity
