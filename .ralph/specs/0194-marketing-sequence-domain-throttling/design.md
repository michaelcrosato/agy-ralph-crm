# Specification: Marketing Sequence Domain Throttling & Recipient Frequency Capping - Design

## 1. Relational Database Additions (`packages/db/src/schema.ts`)

We will define a new Drizzle table `marketingSequenceCaps`:

```typescript
export const marketingSequenceCaps = pgTable("marketing_sequence_caps", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  domainThrottleLimit: integer("domain_throttle_limit").notNull().default(5),
  recipientFrequencyCap: integer("recipient_frequency_cap").notNull().default(3),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
```

We will also update `packages/db/src/index.ts` to:
- Define typescript interface types `DBMarketingSequenceCap` and its insert type.
- Add `marketingSequenceCaps` to `store` and `dbStore` interfaces with mock in-memory CRUD operations (`findMany`, `findOne`, `insert`, `update`, `clear`).

## 2. Core Worker Loop Upgrades (`packages/core/src/index.ts`)

Inside `executePendingSequenceSteps`:
- Resolve recipient email:
  - If `membership.recordType === "lead"`, fetch the lead via `dbStore.leads.findOne`.
  - If `membership.recordType === "contact"`, fetch the contact via `dbStore.contacts.findOne`.
- Parse domain:
  - `const email = recipient.email;`
  - `const domain = email.split("@")[1]?.toLowerCase() || "";`
- Query activities and count sent emails:
  - Iterate all activities where `activity.orgId === activeOrgId`, `activity.type === "email"`, and `activity.createdAt` is within the last 24 hours (for domain) or 7 days (for recipient).
  - Note: Since we use Mock DB stores in integration testing, we can retrieve all emails and filter manually.
  - To count domain matches: check if recipient email ends with `@domain` (case-insensitive).
  - To count recipient matches: check if `activityLink` connects this activity to the current recipient ID (Lead or Contact).
- Retrieve capping rules for the tenant via `dbStore.marketingSequenceCaps.findMany()`. If not found, use standard default values (5 for domain, 3 for recipient).
- Defer step execution:
  ```typescript
  if (domainSentCount >= caps.domainThrottleLimit) {
    await dbStore.marketingSequenceMemberships.update(membership.id, {
      nextExecutionAt: new Date(currentTime.getTime() + 24 * 60 * 60 * 1000),
    });
    await dbStore.auditLogs.insert({
      orgId,
      recordId: membership.id,
      recordType: "marketing_sequence_memberships",
      action: "deferred_domain_throttle",
      userId: "system",
      changes: {
        domain: { before: null, after: domain },
        sentCount: { before: null, after: domainSentCount },
        limit: { before: null, after: caps.domainThrottleLimit }
      }
    });
    continue;
  }
  ```

## 3. Hono REST Endpoints (`apps/api/src/index.ts`)

We will expose the following endpoints:
- **GET `/api/sequences/settings/caps`**: Returns the tenant's capping configuration.
- **POST `/api/sequences/settings/caps`**: Inserts or updates the tenant's configuration. Validates that `domainThrottleLimit > 0` and `recipientFrequencyCap > 0`.
