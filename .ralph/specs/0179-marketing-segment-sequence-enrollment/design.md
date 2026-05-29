# Specification: Marketing Segment Sequence Enrollment API - Design

## 1. Core Logic Design (`packages/core/src/index.ts`)

We implement a new core automation function `enrollSegmentInSequence` that manages bulk processing logic.

```typescript
export async function enrollSegmentInSequence(
  dbStore: {
    marketingSegments: {
      findOne: (id: string) => Promise<any>;
    };
    marketingSequences: {
      findOne: (id: string) => Promise<any>;
    };
    marketingSequenceSteps: {
      findForSequence: (sequenceId: string) => Promise<any[]>;
    };
    marketingSequenceMemberships: {
      findForSequence: (sequenceId: string) => Promise<any[]>;
      insert: (item: any) => Promise<any>;
    };
    leads: {
      findMany: () => Promise<any[]>;
    };
    contacts: {
      findMany: () => Promise<any[]>;
    };
  },
  orgId: string,
  segmentId: string,
  sequenceId: string,
): Promise<{
  enrolledCount: number;
  skippedCount: number;
  memberships: any[];
}> {
  const segment = await dbStore.marketingSegments.findOne(segmentId);
  if (!segment) {
    throw new Error("Segment not found");
  }

  const sequence = await dbStore.marketingSequences.findOne(sequenceId);
  if (!sequence) {
    throw new Error("Sequence not found");
  }

  // 1. Resolve members of the segment
  let members: any[] = [];
  if (segment.objectType === "lead") {
    const leads = await dbStore.leads.findMany();
    members = leads.filter((l) => evaluateSegmentCriteria(l, segment.criteria));
  } else {
    const contacts = await dbStore.contacts.findMany();
    members = contacts.filter((c) => evaluateSegmentCriteria(c, segment.criteria));
  }

  // 2. Fetch existing active memberships in target sequence
  const existingMemberships = await dbStore.marketingSequenceMemberships.findForSequence(sequenceId);
  const activeRecordIds = new Set(
    existingMemberships
      .filter((m) => m.status === "active")
      .map((m) => m.recordId)
  );

  // 3. Enroll non-duplicate members
  const newlyEnrolled: any[] = [];
  let skipped = 0;

  for (const member of members) {
    if (activeRecordIds.has(member.id)) {
      skipped++;
      continue;
    }

    const membership = await enrollInSequence(
      dbStore,
      orgId,
      sequenceId,
      segment.objectType as "lead" | "contact",
      member.id,
    );
    newlyEnrolled.push(membership);
  }

  return {
    enrolledCount: newlyEnrolled.length,
    skippedCount: skipped,
    memberships: newlyEnrolled,
  };
}
```

## 2. REST API Endpoints Design (`apps/api/src/index.ts`)

### `POST /api/segments/:id/enroll-sequence`
- **Request URL**: `/api/segments/:id/enroll-sequence`
- **Body**: `{ sequenceId: string }`
- **Controller Logic**:
  - Get active tenant token org context.
  - Assert `sequenceId` is provided.
  - Call `enrollSegmentInSequence`.
  - Return `{ success: true, enrolledCount, skippedCount, memberships }`.

### `POST /api/sequences/:id/enroll-segment`
- **Request URL**: `/api/sequences/:id/enroll-segment`
- **Body**: `{ segmentId: string }`
- **Controller Logic**:
  - Get active tenant token org context.
  - Assert `segmentId` is provided.
  - Call `enrollSegmentInSequence`.
  - Return `{ success: true, enrolledCount, skippedCount, memberships }`.
