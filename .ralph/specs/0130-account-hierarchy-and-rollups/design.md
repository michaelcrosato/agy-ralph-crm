# Spec 0130: Account Hierarchy & Consolidated Opportunity Rollups Design

## 1. Database Schema Mappings (`packages/db/src/schema.ts`)

```typescript
export const accounts = pgTable("accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  ownerId: uuid("owner_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  domain: text("domain"),
  custom: jsonb("custom"),
  parentAccountId: uuid("parent_account_id").references(
    (): AnyPgColumn => accounts.id,
    { onDelete: "set null" },
  ),
});
```

*Note: In self-referencing pgTables in Drizzle, we define recursive dependencies using a functional parameter referencing itself.*

## 2. Store Interfaces (`packages/db/src/index.ts`)

Update `accounts` store interface and implementation to include hierarchical fetch operations or support reading/writing `parentAccountId`:

```typescript
export interface DBAccount {
  id: string;
  orgId: string;
  ownerId: string;
  name: string;
  domain: string | null;
  custom: Record<string, unknown> | null;
  parentAccountId: string | null;
}
```

Add supporting query methods to account store:
* `findChildren(parentId: string): Promise<DBAccount[]>` - fetches all accounts where `parentAccountId = parentId`.
* `findParentPath(accountId: string): Promise<DBAccount[]>` - traverses parents recursively to build an array of ancestor accounts from direct parent up to root.

## 3. Core Business Logic (`packages/core/src/index.ts`)

```typescript
export interface SimpleAccountRelation {
  id: string;
  parentAccountId: string | null;
}

export interface SimpleOpportunityRelation {
  accountId: string | null;
  stage: string;
  amount: string | null;
}

/**
 * Validates whether setting proposedParentId as the parent of targetId
 * would introduce a circular hierarchy cycle.
 */
export function detectCircularAccountRelation(
  accountsList: SimpleAccountRelation[],
  targetId: string,
  proposedParentId: string,
): boolean {
  if (targetId === proposedParentId) return true;

  // Build a lookup map of id -> parentAccountId
  const parentMap = new Map<string, string | null>();
  for (const acct of accountsList) {
    parentMap.set(acct.id, acct.parentAccountId);
  }

  // Set the proposed relation in our local lookup map
  parentMap.set(targetId, proposedParentId);

  // Traverse upwards from proposedParentId to see if we ever hit targetId
  let currentId: string | null = proposedParentId;
  const visited = new Set<string>();

  while (currentId) {
    if (visited.has(currentId)) {
      // Internal pre-existing cycle or infinite loop safety
      return true;
    }
    visited.add(currentId);

    if (currentId === targetId) {
      return true;
    }

    currentId = parentMap.get(currentId) || null;
  }

  return false;
}

/**
 * Aggregates opportunity pipeline values recursively for a parent account and all its children.
 */
export function rollupHierarchyPipeline(
  accounts: SimpleAccountRelation[],
  opportunities: SimpleOpportunityRelation[],
  rootAccountId: string,
): { activePipeline: string; closedWonPipeline: string } {
  // Find all children descendants of the root account
  const descendantIds = new Set<string>([rootAccountId]);
  
  // Keep scanning until no new descendants are added
  let added = true;
  while (added) {
    added = false;
    for (const acct of accounts) {
      if (acct.parentAccountId && descendantIds.has(acct.parentAccountId) && !descendantIds.has(acct.id)) {
        descendantIds.add(acct.id);
        added = true;
      }
    }
  }

  let activeSum = 0;
  let closedWonSum = 0;

  for (const opp of opportunities) {
    if (opp.accountId && descendantIds.has(opp.accountId)) {
      const amount = Number.parseFloat(opp.amount || "0") || 0;
      if (opp.stage === "Closed Won") {
        closedWonSum += amount;
      } else if (opp.stage !== "Closed Lost") {
        activeSum += amount;
      }
    }
  }

  return {
    activePipeline: activeSum.toFixed(2),
    closedWonPipeline: closedWonSum.toFixed(2),
  };
}
```

## 4. API Endpoints (`apps/api/src/index.ts`)

* `GET /api/accounts/:id/hierarchy`
  - Verifies account context
  - Traverses and returns `{ parentPath: DBAccount[], children: DBAccount[] }`
* `GET /api/accounts/:id/consolidated-pipeline`
  - Fetches all accounts and opportunities in the tenant context
  - Performs core `rollupHierarchyPipeline` logic and returns `{ activePipeline: string, closedWonPipeline: string }`
* `PATCH /api/accounts/:id`
  - Validates `parentAccountId` ownership and runs `detectCircularAccountRelation` check if `parentAccountId` is updated.
  - Logs audit trail changes (`parentAccountId`) and dispatches `account.hierarchy_updated` webhook.
