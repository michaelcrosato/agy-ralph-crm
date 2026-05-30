import type { CoreSequenceMembership, CoreSequenceStep } from "../../../types";
import { personalizeEmailTemplate } from "../../email";
import { advanceMembershipToNextStep } from "./helpers";
import type { SequenceDbStore } from "./types";

/**
 * Executes a task step type in the sequence.
 */
export async function executeTaskStep(
  dbStore: SequenceDbStore,
  membership: CoreSequenceMembership,
  step: CoreSequenceStep,
  steps: CoreSequenceStep[],
  currentTime: Date,
  recipientContext: {
    lead?: Record<string, unknown> | null;
    contact?: Record<string, unknown> | null;
  },
  nextStepNumber: number,
  sequenceSendsToday: Map<string, number>,
): Promise<void> {
  const orgId = membership.orgId;

  if (dbStore.activities && step.taskSubject) {
    const personalized = personalizeEmailTemplate(
      { subject: step.taskSubject, body: step.taskBody || "" },
      recipientContext,
    );

    let dueDate: Date | null = null;
    if (step.taskDueDays !== undefined && step.taskDueDays !== null) {
      dueDate = new Date(
        currentTime.getTime() + step.taskDueDays * 24 * 60 * 60 * 1000,
      );
    }

    const creatorId = "00000000-0000-0000-0000-000000000000";

    const act = await dbStore.activities.insert({
      orgId,
      creatorId,
      type: "task",
      subject: personalized.subject,
      body: personalized.body,
      dueDate,
      custom: null,
    });

    if (dbStore.activityLinks && act?.id) {
      const targetType =
        membership.recordType === "lead"
          ? "Lead"
          : membership.recordType === "contact"
            ? "Contact"
            : "Lead";

      await dbStore.activityLinks.insert({
        orgId,
        activityId: act.id,
        targetType,
        targetId: membership.recordId,
      });
    }
  }

  await advanceMembershipToNextStep(
    dbStore,
    membership,
    steps,
    currentTime,
    nextStepNumber,
    sequenceSendsToday,
  );
}
