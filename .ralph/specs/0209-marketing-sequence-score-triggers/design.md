# Specification: Marketing Sequence Score-Based Automation Triggers - Design

## 1. Database Schema Extensions

We add the `DBMarketingSequenceScoreTrigger` interface and `marketingSequenceScoreTriggers` store in `packages/db`.

### 1.1 Types and Interfaces
```typescript
export interface DBMarketingSequenceScoreTrigger {
  id: string;
  orgId: string;
  sequenceId: string;
  scoreThreshold: number;
  actionType: "change_lead_status" | "auto_exit" | "notify_owner";
  actionConfig: {
    status?: string;
    subject?: string;
    body?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}
```

### 1.2 Store Initialization in `store` (`packages/db/src/index.ts`)
```typescript
marketingSequenceScoreTriggers: [] as DBMarketingSequenceScoreTrigger[],
```

### 1.3 `dbStore` Key Implementation
We add the CRUD operations with standard active tenant isolation:
- `findMany()`: Returns triggers filtering by `orgId`.
- `findForSequence(sequenceId)`: Returns triggers filtering by `sequenceId` and `orgId`.
- `findOne(id)`: Returns a single trigger checking `orgId`.
- `insert(item)`: Inserts checking that `item.orgId === activeOrgId`.
- `delete(id)`: Deletes checking `orgId` boundaries.

## 2. Core Engine Processing Logic

We implement `processSequenceMembershipScoreTriggers` inside `packages/core/src/index.ts`:

```typescript
export async function processSequenceMembershipScoreTriggers(
  db: any,
  orgId: string,
  membershipId: string,
): Promise<{ triggeredCount: number; executedActions: string[] }> {
  // 1. Fetch sequence membership
  const membership = await db.marketingSequenceMemberships.findOne(membershipId);
  if (!membership || membership.status !== "active") {
    return { triggeredCount: 0, executedActions: [] };
  }

  // 2. Fetch all triggers for the sequence
  const triggers = await db.marketingSequenceScoreTriggers.findForSequence(membership.sequenceId);
  const currentScore = membership.engagementScore ?? 0;

  const executedActions: string[] = [];
  let triggeredCount = 0;

  for (const trigger of triggers) {
    if (currentScore >= trigger.scoreThreshold) {
      triggeredCount++;
      const actionType = trigger.actionType;

      if (actionType === "change_lead_status") {
        if (membership.recordType === "lead") {
          const lead = await db.leads.findOne(membership.recordId);
          const targetStatus = trigger.actionConfig.status || "Qualified";
          if (lead && lead.status !== targetStatus) {
            await db.leads.update(membership.recordId, { status: targetStatus });
            executedActions.push(`change_lead_status:${targetStatus}`);
          }
        }
      } else if (actionType === "auto_exit") {
        if (membership.status === "active") {
          await db.marketingSequenceMemberships.update(membershipId, {
            status: "completed",
          });
          executedActions.push("auto_exit");
        }
      } else if (actionType === "notify_owner") {
        let ownerId = "system";
        let targetType: "Lead" | "Contact" = "Lead";
        if (membership.recordType === "lead") {
          const lead = await db.leads.findOne(membership.recordId);
          if (lead) ownerId = lead.ownerId;
          targetType = "Lead";
        } else {
          const contact = await db.contacts.findOne(membership.recordId);
          if (contact) ownerId = contact.ownerId;
          targetType = "Contact";
        }

        const subject = trigger.actionConfig.subject || `[High Engagement] Follow up needed`;
        const body = trigger.actionConfig.body || `Recipient has reached score ${currentScore}.`;
        
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + 1);

        const task = await db.activities.insert({
          orgId,
          creatorId: "system",
          type: "task",
          subject,
          body,
          dueDate,
        });

        await db.activityLinks.insert({
          orgId,
          activityId: task.id,
          targetType,
          targetId: membership.recordId,
        });

        executedActions.push(`notify_owner:${ownerId}`);
      }
    }
  }

  return { triggeredCount, executedActions };
}
```

## 3. REST Routing Specifications

We integrate the endpoints under `apps/api/src/index.ts`:

- `POST /api/sequences/:id/triggers`: Adds a score trigger to a sequence.
- `GET /api/sequences/:id/triggers`: Lists all triggers for a sequence.
- `DELETE /api/sequences/triggers/:id`: Deletes a trigger by ID.

### Real-Time Pipeline Trigger
Inside `recalculateMemberEngagementScore(membershipId)` in `apps/api/src/index.ts`:
Right after:
```typescript
await dbStore.marketingSequenceMemberships.update(membershipId, {
  engagementScore: score,
});
```
We insert:
```typescript
await processSequenceMembershipScoreTriggers(dbStore, membership.orgId, membershipId);
```
This guarantees that whenever opens, clicks, replies, or read-time events are tracked, the scoring engine recalculates the score and immediately processes any triggers!
