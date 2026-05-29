# Specification: Marketing Sequence A/B Test Winner Auto-Promotion Engine - Design

## 1. Database Schema Changes

### 1.1 Schema Definition (`packages/db/src/schema.ts`)
We will add these columns to the `marketingSequenceStepSplitTests` table:
```typescript
autoPromoteWinner: integer("auto_promote_winner").notNull().default(0),
minSendsToEvaluate: integer("min_sends_to_evaluate").notNull().default(10),
evaluationMetric: text("evaluation_metric").notNull().default("open_rate"),
```

### 1.2 In-Memory DB Types & Mock Stores (`packages/db/src/index.ts`)
Update `DBMarketingSequenceStepSplitTest` interface:
```typescript
export interface DBMarketingSequenceStepSplitTest {
  id: string;
  orgId: string;
  stepId: string;
  variantTemplateId: string;
  splitWeight: number;
  isActive: number;
  autoPromoteWinner: number;
  minSendsToEvaluate: number;
  evaluationMetric: string;
  createdAt: Date;
  updatedAt: Date;
}
```
Update insertion mock defaulting inside `packages/db/src/index.ts`'s `marketingSequenceStepSplitTests.insert` to properly populate:
- `autoPromoteWinner: item.autoPromoteWinner ?? 0`
- `minSendsToEvaluate: item.minSendsToEvaluate ?? 10`
- `evaluationMetric: item.evaluationMetric ?? "open_rate"`

---

## 2. Core Business Logic Changes (`packages/core/src/index.ts`)

### 2.1 Core Types Definition
Update `CoreStepSplitTest` interface:
```typescript
export interface CoreStepSplitTest {
  id: string;
  orgId: string;
  stepId: string;
  variantTemplateId: string;
  splitWeight: number;
  isActive: number;
  autoPromoteWinner: number;
  minSendsToEvaluate: number;
  evaluationMetric: string;
  createdAt: Date;
  updatedAt: Date;
}
```

### 2.2 Background Execution Loop Integration
Add an evaluation block at the beginning of processing active split tests inside `executePendingSequenceSteps`:
```typescript
if (
  dbStore.marketingSequenceStepSplitTests &&
  dbStore.marketingSequenceAbAllocations &&
  dbStore.marketingSequenceMemberships &&
  dbStore.activities &&
  (dbStore as any).emailTrackers
) {
  const splitTest = await dbStore.marketingSequenceStepSplitTests.findForStep(step.id);
  if (splitTest && splitTest.isActive === 1) {
    if (splitTest.autoPromoteWinner === 1) {
      // 1. Gather all memberships in the sequence
      const seqMemberships = await dbStore.marketingSequenceMemberships.findMany();
      const relevantMembers = seqMemberships.filter(m => m.sequenceId === membership.sequenceId);

      // 2. Fetch all allocations for this step
      const stepAllocations = await dbStore.marketingSequenceAbAllocations.findMany();
      const relevantAllocs = stepAllocations.filter(a => a.stepId === step.id);

      // 3. Fetch all activity links, activities, and trackers under tenancy
      const activityLinks = await dbStore.activityLinks.findMany();
      const activities = await dbStore.activities.findMany();
      const emailTrackers = await (dbStore as any).emailTrackers.findMany();

      const trackerByActivity = new Map<string, { openCount: number; clickCount: number }>();
      for (const tracker of emailTrackers) {
        trackerByActivity.set(tracker.activityId, {
          openCount: tracker.openCount,
          clickCount: tracker.clickCount,
        });
      }

      let baseSends = 0;
      let baseOpens = 0;
      let baseClicks = 0;
      let variantSends = 0;
      let variantOpens = 0;
      let variantClicks = 0;

      for (const m of relevantMembers) {
        const alloc = relevantAllocs.find(a => a.membershipId === m.id);
        if (!alloc) continue;

        // Sort email activities to align with index = step.stepNumber - 1
        const linksForRecord = activityLinks.filter(
          link => link.targetId === m.recordId &&
                  (link.targetType === "Lead" || link.targetType === "Contact")
        );
        const activityIds = linksForRecord.map(l => l.activityId);
        const emailActs = activities.filter(
          act => act.type === "email" && activityIds.includes(act.id)
        );
        emailActs.sort((a, b) => a.id.localeCompare(b.id));

        const actForStep = emailActs[step.stepNumber - 1];
        if (actForStep) {
          const tracker = trackerByActivity.get(actForStep.id);
          const isOpened = tracker ? tracker.openCount > 0 : false;
          const isClicked = tracker ? tracker.clickCount > 0 : false;

          if (alloc.allocatedTemplateId === step.templateId) {
            baseSends++;
            if (isOpened) baseOpens++;
            if (isClicked) baseClicks++;
          } else if (alloc.allocatedTemplateId === splitTest.variantTemplateId) {
            variantSends++;
            if (isOpened) variantOpens++;
            if (isClicked) variantClicks++;
          }
        }
      }

      const totalSends = baseSends + variantSends;
      if (totalSends >= splitTest.minSendsToEvaluate) {
        let baseRate = 0;
        let variantRate = 0;
        if (splitTest.evaluationMetric === "open_rate") {
          baseRate = baseSends > 0 ? baseOpens / baseSends : 0;
          variantRate = variantSends > 0 ? variantOpens / variantSends : 0;
        } else if (splitTest.evaluationMetric === "click_rate") {
          baseRate = baseSends > 0 ? baseClicks / baseSends : 0;
          variantRate = variantSends > 0 ? variantClicks / variantSends : 0;
        }

        let winnerTemplateId = step.templateId;
        let winnerLabel = "base";

        if (variantRate > baseRate) {
          winnerTemplateId = splitTest.variantTemplateId;
          winnerLabel = "variant";
        }

        // Perform Promotion
        await dbStore.marketingSequenceSteps.update(step.id, {
          templateId: winnerTemplateId,
        });

        // Deactivate Split Test
        await dbStore.marketingSequenceStepSplitTests.update(splitTest.id, {
          isActive: 0,
        });

        // Log Audit Log
        await dbStore.auditLogs.insert({
          orgId,
          recordId: splitTest.id,
          recordType: "marketing_sequence_step_split_tests",
          action: "auto_promoted",
          userId: "00000000-0000-0000-0000-000000000000",
          changes: {
            winnerTemplateId,
            winnerLabel,
            evaluationMetric: splitTest.evaluationMetric,
            totalSends,
            baseSends,
            baseRate,
            variantSends,
            variantRate,
          },
        });

        // Mutate the local splitTest in context so that the current run immediately bypasses split testing
        splitTest.isActive = 0;
        step.templateId = winnerTemplateId;
      }
    }
  }
}
```

---

## 3. REST API Design Changes (`apps/api/src/index.ts`)

Update endpoints:
- `POST /api/sequences/:id/steps/:stepId/split-test`:
  - Validate parameters:
    - `autoPromoteWinner`: must be `0` or `1` if provided.
    - `minSendsToEvaluate`: must be a positive integer if provided.
    - `evaluationMetric`: must be either `"open_rate"` or `"click_rate"` if provided.
  - Set defaults on creation if not provided.
