# Specification: Marketing Sequence Suppression Lists & Exclusion Rules Engine - Design

## 1. Database Schema

We will append the following two tables to `packages/db/src/schema.ts`:

### 1.1 `marketing_sequence_suppressions`
Stores global suppression lists.
```typescript
export const marketingSequenceSuppressions = pgTable(
  "marketing_sequence_suppressions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    recordType: text("record_type").notNull(), // "lead" | "contact" | "email_domain"
    recordId: uuid("record_id"), // optional specific record reference
    pattern: text("pattern"), // e.g. "competitor.com", "user@domain.com"
    reason: text("reason").notNull().default("opt_out"), // "opt_out" | "competitor" | "bounce" | "complaint"
    createdAt: timestamp("created_at").notNull().defaultNow(),
  }
);
```

### 1.2 `marketing_sequence_exclusions`
Stores sequence-specific exclusion rules.
```typescript
export const marketingSequenceExclusions = pgTable(
  "marketing_sequence_exclusions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    sequenceId: uuid("sequence_id")
      .notNull()
      .references(() => marketingSequences.id, { onDelete: "cascade" }),
    exclusionType: text("exclusion_type").notNull(), // "domain" | "segment" | "email"
    exclusionValue: text("exclusion_value").notNull(), // e.g. "competitor.com", segmentId, "opt@out.com"
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  }
);
```

---

## 2. Core Business Logic

We will add type interfaces and functions to `packages/core/src/index.ts`.

### 2.1 Types
```typescript
export interface CoreSequenceSuppression {
  id: string;
  orgId: string;
  recordType: string;
  recordId: string | null;
  pattern: string | null;
  reason: string;
  createdAt: Date;
}

export interface CoreSequenceExclusion {
  id: string;
  orgId: string;
  sequenceId: string;
  exclusionType: string;
  exclusionValue: string;
  createdAt: Date;
  updatedAt: Date;
}
```

### 2.2 Core Functions

#### `isRecordSuppressedOrExcluded`
Checks whether a lead or contact matches global suppressions or sequence-specific exclusions.
```typescript
export async function isRecordSuppressedOrExcluded(params: {
  orgId: string;
  sequenceId: string;
  recordType: "lead" | "contact";
  recordId: string;
  email: string | null | undefined;
  dbStore: {
    marketingSequenceSuppressions: {
      findForOrg: (orgId: string) => Promise<CoreSequenceSuppression[]>;
    };
    marketingSequenceExclusions: {
      findForSequence: (sequenceId: string) => Promise<CoreSequenceExclusion[]>;
    };
    marketingSegmentMemberships?: {
      findForRecord: (recordType: string, recordId: string) => Promise<{ segmentId: string }[]>;
    };
  };
}): Promise<{ suppressed: boolean; reason: string | null }> {
  // 1. Resolve email domain and full email address
  const emailVal = params.email?.trim().toLowerCase();
  const domainVal = emailVal ? emailVal.split("@")[1] : null;

  // 2. Fetch and evaluate Global Suppressions
  const suppressions = await params.dbStore.marketingSequenceSuppressions.findForOrg(params.orgId);
  for (const s of suppressions) {
    if (s.recordType === params.recordType && s.recordId === params.recordId) {
      return { suppressed: true, reason: `Global suppression list match for ${params.recordType} ID ${params.recordId} (${s.reason})` };
    }
    if (s.recordType === "email_domain" && s.pattern) {
      const patternLower = s.pattern.trim().toLowerCase();
      if (emailVal === patternLower || domainVal === patternLower) {
        return { suppressed: true, reason: `Global suppression list match for pattern ${s.pattern} (${s.reason})` };
      }
    }
  }

  // 3. Fetch and evaluate Sequence-Specific Exclusions
  const exclusions = await params.dbStore.marketingSequenceExclusions.findForSequence(params.sequenceId);
  if (exclusions.length > 0) {
    let recordSegments: string[] = [];
    if (params.dbStore.marketingSegmentMemberships) {
      const memberships = await params.dbStore.marketingSegmentMemberships.findForRecord(params.recordType, params.recordId);
      recordSegments = memberships.map(m => m.segmentId);
    }

    for (const ex of exclusions) {
      if (ex.exclusionType === "email" && emailVal === ex.exclusionValue.trim().toLowerCase()) {
        return { suppressed: true, reason: `Sequence exclusion rule: specific email ${ex.exclusionValue}` };
      }
      if (ex.exclusionType === "domain" && domainVal === ex.exclusionValue.trim().toLowerCase()) {
        return { suppressed: true, reason: `Sequence exclusion rule: email domain ${ex.exclusionValue}` };
      }
      if (ex.exclusionType === "segment" && recordSegments.includes(ex.exclusionValue)) {
        return { suppressed: true, reason: `Sequence exclusion rule: member of excluded segment ${ex.exclusionValue}` };
      }
    }
  }

  return { suppressed: false, reason: null };
}
```

---

## 3. REST API Routing Plan

We will add the following endpoints to `apps/api/src/index.ts`:

- `GET /api/sequences/suppressions` -> returns `marketingSequenceSuppressions` filtered by org ID.
- `POST /api/sequences/suppressions` -> inserts new suppression record.
- `DELETE /api/sequences/suppressions/:id` -> deletes suppression record by ID (with org verification).
- `GET /api/sequences/:id/exclusions` -> returns `marketingSequenceExclusions` for a sequence.
- `POST /api/sequences/:id/exclusions` -> inserts new exclusion rule.
- `DELETE /api/sequences/:id/exclusions/:exclusionId` -> deletes exclusion rule.
