import type { CoreSequenceMembership, CoreSequenceStep } from "../../../types";
import { calculateNextStepExecutionTime } from "../../shared";
import type { SequenceDbStore } from "./types";

/**
 * Shared helper to advance a membership to its next scheduled step or complete it.
 */
export async function advanceMembershipToNextStep(
  dbStore: SequenceDbStore,
  membership: CoreSequenceMembership,
  steps: CoreSequenceStep[],
  currentTime: Date,
  nextStepNumber: number,
  sequenceSendsToday: Map<string, number>,
): Promise<void> {
  let nextStatus = "active";
  let nextExecTime = new Date();

  const stepJustExecuted = steps.find((s) => s.stepNumber === nextStepNumber);
  const branchForExecutedStep =
    stepJustExecuted && dbStore.marketingSequenceStepBranches
      ? await dbStore.marketingSequenceStepBranches.findForStep(
          stepJustExecuted.id,
        )
      : null;

  if (branchForExecutedStep) {
    nextExecTime = new Date(
      currentTime.getTime() +
        branchForExecutedStep.evaluationWindowDays * 24 * 60 * 60 * 1000,
    );
  } else {
    const nextStep = steps.find((s) => s.stepNumber === nextStepNumber + 1);
    if (!nextStep) {
      nextStatus = "completed";
    } else {
      nextExecTime = calculateNextStepExecutionTime(
        currentTime,
        nextStep.delayDays,
        nextStep.waitCondition || undefined,
      );
    }
  }

  await dbStore.marketingSequenceMemberships.update(membership.id, {
    status: nextStatus,
    currentStepNumber: nextStepNumber,
    lastExecutedAt: currentTime,
    nextExecutionAt: nextExecTime,
  });

  await dbStore.auditLogs.insert({
    orgId: membership.orgId,
    recordId: membership.id,
    recordType: "marketing_sequence_memberships",
    action: "execute_step",
    userId: "00000000-0000-0000-0000-000000000000",
    changes: {
      stepNumber: {
        before: membership.currentStepNumber,
        after: nextStepNumber,
      },
      status: { before: membership.status, after: nextStatus },
    },
  });

  const count = sequenceSendsToday.get(membership.sequenceId) || 0;
  sequenceSendsToday.set(membership.sequenceId, count + 1);

  // Sync local object state in-memory
  membership.status = nextStatus;
  membership.currentStepNumber = nextStepNumber;
  membership.lastExecutedAt = currentTime;
  membership.nextExecutionAt = nextExecTime;
}

/**
 * Evaluates the branching rule for the current membership step to determine the next step number.
 */
export async function executeBranchStep(
  dbStore: SequenceDbStore,
  membership: CoreSequenceMembership,
  steps: CoreSequenceStep[],
): Promise<number> {
  let nextStepNumber = membership.currentStepNumber + 1;

  if (
    membership.currentStepNumber > 0 &&
    dbStore.marketingSequenceStepBranches
  ) {
    const currentStepObj = steps.find(
      (s) => s.stepNumber === membership.currentStepNumber,
    );
    if (currentStepObj) {
      const branchRule =
        await dbStore.marketingSequenceStepBranches.findForStep(
          currentStepObj.id,
        );
      if (branchRule) {
        // biome-ignore lint/suspicious/noExplicitAny: dbStore dynamic
        const allLinks = await (dbStore as any).activityLinks.findMany();
        // biome-ignore lint/suspicious/noExplicitAny: dbStore dynamic
        const allActivities = await (dbStore as any).activities.findMany();
        // biome-ignore lint/suspicious/noExplicitAny: dbStore dynamic
        const allTrackers = await (dbStore as any).emailTrackers.findMany();

        const recordLinks = allLinks.filter(
          // biome-ignore lint/suspicious/noExplicitAny: link dynamic
          (link: any) =>
            link.targetId === membership.recordId &&
            (link.targetType === "Lead" || link.targetType === "Contact"),
        );
        // biome-ignore lint/suspicious/noExplicitAny: link dynamic
        const recordActivityIds = recordLinks.map((l: any) => l.activityId);
        const emailActs = allActivities.filter(
          // biome-ignore lint/suspicious/noExplicitAny: act dynamic
          (act: any) =>
            act.type === "email" && recordActivityIds.includes(act.id),
        );
        // biome-ignore lint/suspicious/noExplicitAny: act dynamic
        emailActs.sort((a: any, b: any) => a.id.localeCompare(b.id));

        const stepActivity = emailActs[membership.currentStepNumber - 1];
        let conditionMet = false;
        if (stepActivity) {
          const tracker = allTrackers.find(
            // biome-ignore lint/suspicious/noExplicitAny: tracker dynamic
            (t: any) => t.activityId === stepActivity.id,
          );
          if (tracker) {
            if (branchRule.branchType === "email_open") {
              conditionMet = tracker.openCount > 0;
            } else if (branchRule.branchType === "email_click") {
              conditionMet = tracker.clickCount > 0;
            }
          }
        }

        nextStepNumber = conditionMet
          ? branchRule.trueNextStepNumber
          : branchRule.falseNextStepNumber;
      }
    }
  }

  return nextStepNumber;
}
