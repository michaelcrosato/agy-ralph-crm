# Specification: Marketing Sequence Sending Schedule & Deferral Engine - Design

## 1. Database Schema

We will add three optional columns to the `marketing_sequences` table in `packages/db/src/schema.ts`:

- `sendingWindowStart`: `text("sending_window_start")` (nullable)
- `sendingWindowEnd`: `text("sending_window_end")` (nullable)
- `sendingDays`: `jsonb("sending_days")` (nullable)

```typescript
export const marketingSequences = pgTable("marketing_sequences", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  status: text("status").notNull().default("draft"),
  sendingWindowStart: text("sending_window_start"),
  sendingWindowEnd: text("sending_window_end"),
  sendingDays: jsonb("sending_days"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
```

We must also update interfaces:
- `DBMarketingSequence` in `packages/db/src/index.ts`
- `CoreSequence` in `packages/core/src/index.ts` (if exists, else handle dynamically)

```typescript
export interface DBMarketingSequence {
  id: string;
  orgId: string;
  name: string;
  description: string;
  status: string; // "active" | "draft"
  sendingWindowStart: string | null;
  sendingWindowEnd: string | null;
  sendingDays: number[] | null;
  createdAt: Date;
  updatedAt: Date;
}
```

---

## 2. Core Business Logic

We will implement a helper function `getNextValidSendingTime` in `packages/core/src/index.ts`:

```typescript
export function getNextValidSendingTime(
  currentTime: Date,
  sendingDays: number[] | null,
  windowStart: string | null,
  windowEnd: string | null,
): Date {
  const target = new Date(currentTime.getTime());
  
  // Default to Mon-Fri if sendingDays is defined but empty, or allow all days if null
  const allowedDays = sendingDays && sendingDays.length > 0 ? new Set(sendingDays) : null;
  
  let attempts = 0;
  // Maximum loop of 8 days to prevent infinite loops and find next window
  while (attempts < 8) {
    const dayOfWeek = target.getUTCDay() === 0 ? 7 : target.getUTCDay(); // Convert Sun=0 to Sun=7
    
    const dayAllowed = !allowedDays || allowedDays.has(dayOfWeek);
    
    if (dayAllowed) {
      const currentHours = target.getUTCHours();
      const currentMinutes = target.getUTCMinutes();
      const currentTimeMinutes = currentHours * 60 + currentMinutes;
      
      const startMinutes = windowStart ? parseTimeToMinutes(windowStart) : 0;
      const endMinutes = windowEnd ? parseTimeToMinutes(windowEnd) : 24 * 60;
      
      if (currentTimeMinutes < startMinutes) {
        // Defer to start of window today
        target.setUTCHours(Math.floor(startMinutes / 60), startMinutes % 60, 0, 0);
        return target;
      }
      
      if (currentTimeMinutes >= startMinutes && currentTimeMinutes < endMinutes) {
        // Current time is within the allowed window on an allowed day!
        return target;
      }
    }
    
    // Move to the next day at the start of the sending window (or 00:00 if none configured)
    target.setUTCDate(target.getUTCDate() + 1);
    const startMinutes = windowStart ? parseTimeToMinutes(windowStart) : 0;
    target.setUTCHours(Math.floor(startMinutes / 60), startMinutes % 60, 0, 0);
    attempts++;
  }
  
  return currentTime;
}

function parseTimeToMinutes(timeStr: string): number {
  const [hours, minutes] = timeStr.split(":").map(Number);
  return hours * 60 + minutes;
}
```

We will integrate this check into the pending membership iteration within `executePendingSequenceSteps`:

```typescript
// During pending sequence step execution:
const sequence = await dbStore.marketingSequences.findOne(m.sequenceId);
if (sequence) {
  const validTime = getNextValidSendingTime(
    currentTime,
    sequence.sendingDays as number[] | null,
    sequence.sendingWindowStart,
    sequence.sendingWindowEnd
  );
  
  if (validTime.getTime() > currentTime.getTime()) {
    // Schedule is in the future. Defer!
    await dbStore.marketingSequenceMemberships.update(m.id, {
      nextExecutionAt: validTime,
    });
    
    await dbStore.auditLogs.insert({
      orgId: m.orgId,
      recordId: m.id,
      recordType: "marketing_sequence_memberships",
      action: "membership_schedule_deferred",
      userId: "00000000-0000-0000-0000-000000000000",
      changes: {
        nextExecutionAt: {
          before: m.nextExecutionAt.toISOString(),
          after: validTime.toISOString(),
        },
      },
    });
    
    continue; // Skip execution in the current cycle
  }
}
```

---

## 3. REST API Routing

Inside `apps/api/src/index.ts`, add the following endpoint:

### 3.1 `POST /api/sequences/:id/schedule`
- Verifies sequence exists and belongs to the current tenant orgId.
- Parses `sendingWindowStart`, `sendingWindowEnd`, and `sendingDays`.
- Validates the time strings and days array.
- Calls `dbStore.marketingSequences.update` and returns the updated sequence data.
