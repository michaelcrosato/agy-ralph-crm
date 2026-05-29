# Specification: Marketing Sequence Campaign Automated Re-Enrollment & Frequency Capping Controls - Design

## 1. Database Schema Changes

### 1.1 Drizzle Schema Definition (`packages/db/src/schema.ts`)
We will add `allowReenrollment` and `reenrollmentMinDays` properties to the `marketingSequences` table:
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
  allowReenrollment: boolean("allow_reenrollment").notNull().default(false),
  reenrollmentMinDays: integer("reenrollment_min_days"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
```

### 1.2 In-Memory Mock Store Updates (`packages/db/src/index.ts`)
Extend the `DBMarketingSequence` interface to support these fields:
```typescript
export interface DBMarketingSequence {
  id: string;
  orgId: string;
  name: string;
  description: string;
  status: string; // "active" | "draft"
  sendingWindowStart?: string | null;
  sendingWindowEnd?: string | null;
  sendingDays?: number[] | null;
  allowReenrollment?: boolean | null;
  reenrollmentMinDays?: number | null;
  createdAt: Date;
  updatedAt: Date;
}
```

---

## 2. Core Business Logic Upgrades

### 2.1 Core Types (`packages/core/src/index.ts`)
Extend the `CoreSequence` interface:
```typescript
interface CoreSequence {
  id: string;
  orgId: string;
  name: string;
  description: string;
  status: string;
  sendingWindowStart?: string | null;
  sendingWindowEnd?: string | null;
  sendingDays?: number[] | null;
  allowReenrollment?: boolean | null;
  reenrollmentMinDays?: number | null;
  createdAt: Date;
  updatedAt: Date;
}
```

### 2.2 `enrollInSequence` Upgrades
Update the `enrollInSequence` utility function to enforce re-enrollment rules:
```typescript
export async function enrollInSequence(
  dbStore: {
    marketingSequenceSteps: {
      findForSequence: (sequenceId: string) => Promise<CoreSequenceStep[]>;
    };
    marketingSequenceMemberships: {
      insert: (
        item: Omit<CoreSequenceMembership, "id" | "createdAt" | "updatedAt">,
      ) => Promise<CoreSequenceMembership>;
      findMany?: () => Promise<CoreSequenceMembership[]>;
    };
    leads?: {
      findOne: (id: string) => Promise<unknown | null>;
    };
    contacts?: {
      findOne: (id: string) => Promise<unknown | null>;
    };
    marketingSequenceSuppressions?: {
      findForOrg: (orgId: string) => Promise<CoreSequenceSuppression[]>;
    };
    marketingSequenceExclusions?: {
      findForSequence: (sequenceId: string) => Promise<CoreSequenceExclusion[]>;
    };
    marketingSegmentMemberships?: {
      findForRecord: (
        recordType: string,
        recordId: string,
      ) => Promise<{ segmentId: string }[]>;
    };
    marketingSequences?: {
      findOne: (id: string) => Promise<CoreSequence | null>;
    };
  },
  orgId: string,
  sequenceId: string,
  recordType: "lead" | "contact",
  recordId: string,
): Promise<CoreSequenceMembership> {
  // Check for existing active or snoozed enrollments
  if (dbStore.marketingSequenceMemberships.findMany) {
    const existing = await dbStore.marketingSequenceMemberships.findMany();
    const recipientMemberships = existing.filter(
      (m) =>
        m.sequenceId === sequenceId &&
        m.recordType === recordType &&
        m.recordId === recordId,
    );

    // 1. Prevent overlapping active enrollments
    const active = recipientMemberships.find(
      (m) => m.status === "active" || m.status === "snoozed",
    );
    if (active) {
      throw new Error("Recipient is already actively enrolled in this sequence");
    }

    // 2. Enforce re-enrollment rules
    if (dbStore.marketingSequences) {
      const seq = await dbStore.marketingSequences.findOne(sequenceId);
      if (seq) {
        const allowReenroll = seq.allowReenrollment ?? false;
        if (!allowReenroll && recipientMemberships.length > 0) {
          throw new Error("Re-enrollment is not allowed for this sequence");
        }

        if (allowReenroll && seq.reenrollmentMinDays && seq.reenrollmentMinDays > 0) {
          const minDays = seq.reenrollmentMinDays;
          const now = Date.now();
          for (const prior of recipientMemberships) {
            const lastActiveTime = prior.updatedAt
              ? new Date(prior.updatedAt).getTime()
              : new Date(prior.createdAt).getTime();
            const elapsedDays = (now - lastActiveTime) / (24 * 60 * 60 * 1000);
            if (elapsedDays < minDays) {
              throw new Error(
                `Frequency cap breached: recipient was recently enrolled and must wait at least ${minDays} days before re-enrolling`,
              );
            }
          }
        }
      }
    }
  }

  // Fallback / standard insertion continues ...
```

---

## 3. REST Endpoint Changes (`apps/api/src/index.ts`)

- In `app.post("/api/sequences")`:
  Support extracting `allowReenrollment` and `reenrollmentMinDays` from the request payload.
- In `app.post("/api/sequences/:id/enroll")`:
  Capture errors thrown by `enrollInSequence` and map them to `400 Bad Request` responses:
  ```typescript
  try {
    const membership = await enrollInSequence(
      dbStore,
      tenant.orgId,
      sequenceId,
      recordType,
      recordId,
    );
    return c.json({ success: true, membership });
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 400);
  }
  ```
