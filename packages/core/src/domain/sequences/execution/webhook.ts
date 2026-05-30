import type { CoreSequenceMembership, CoreSequenceStep } from "../../../types";
import { personalizeEmailTemplate } from "../../email";
import { advanceMembershipToNextStep } from "./helpers";
import type { SequenceDbStore } from "./types";

/**
 * Executes a webhook step type in the sequence.
 */
export async function executeWebhookStep(
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
  recipientEmail: string | null,
): Promise<void> {
  const orgId = membership.orgId;

  if (dbStore.webhookOutbox && step.webhookUrl) {
    const rawPayload =
      step.webhookPayload ||
      JSON.stringify({
        event: "sequence.step_executed",
        orgId,
        sequenceId: membership.sequenceId,
        membershipId: membership.id,
        stepNumber: nextStepNumber,
        recordType: membership.recordType,
        recordId: membership.recordId,
        recipientEmail: recipientEmail || null,
      });

    const payload = personalizeEmailTemplate(
      { subject: "", body: rawPayload },
      recipientContext,
    ).body;

    await dbStore.webhookOutbox.insert({
      orgId,
      webhookId: "00000000-0000-0000-0000-000000000000",
      payload,
      status: "pending",
      retryCount: 0,
    });
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
