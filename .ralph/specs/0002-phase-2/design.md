# Phase 2: Primitive Record Core & Event Timelines - Design

## Database Schema (Drizzle ORM)

We will define the following CRM primitive records in `packages/db/src/schema.ts`:

* **`accounts`**
  * `id`: uuid (primary key)
  * `orgId`: uuid (tenant ID)
  * `ownerId`: uuid (user ID)
  * `name`: text (non-nullable)
  * `domain`: text
  * `custom`: jsonb

* **`contacts`**
  * `id`: uuid (primary key)
  * `orgId`: uuid
  * `ownerId`: uuid
  * `accountId`: uuid (references accounts.id)
  * `firstName`: text
  * `lastName`: text
  * `email`: text
  * `custom`: jsonb

* **`leads`**
  * `id`: uuid (primary key)
  * `orgId`: uuid
  * `ownerId`: uuid
  * `status`: text (New, Working, Converted, Unqualified)
  * `email`: text
  * `company`: text
  * `convertedAccountId`: uuid
  * `convertedContactId`: uuid
  * `custom`: jsonb

* **`opportunities`**
  * `id`: uuid (primary key)
  * `orgId`: uuid
  * `ownerId`: uuid
  * `accountId`: uuid (references accounts.id)
  * `stage`: text (Prospecting, Qualification, Closed Won, Closed Lost)
  * `amount`: numeric
  * `closeDate`: timestamp
  * `custom`: jsonb

* **`auditLogs`**
  * `id`: uuid (primary key)
  * `orgId`: uuid
  * `recordId`: uuid (non-nullable)
  * `recordType`: text (non-nullable)
  * `action`: text (create, update, delete)
  * `userId`: uuid (non-nullable)
  * `changes`: jsonb (before/after properties)
  * `createdAt`: timestamp (default now)

## Lead Conversion Contract

In `packages/core/src/index.ts`:
* Logic to process lead conversions:
```typescript
export interface LeadConversionInput {
  leadId: string;
  orgId: string;
  ownerId: string;
  opportunityName?: string;
  opportunityAmount?: number;
}

export interface LeadConversionResult {
  accountId: string;
  contactId: string;
  opportunityId?: string;
}
```
