import { v7 as uuidv7 } from "uuid";
import type {
  CoreSequence,
  CoreSequenceMembership,
  CoreSequenceStep,
} from "../../../types";
import { compileEmailTemplate } from "../../email";
import { advanceMembershipToNextStep } from "./helpers";
import type { SequenceDbStore } from "./types";

/**
 * Executes an email step type in the sequence, handling A/B split testing and personalization.
 */
export async function executeEmailStep(
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
  sequence: CoreSequence | null,
): Promise<void> {
  const orgId = membership.orgId;
  let templateIdToUse = step.templateId || "";

  if (
    dbStore.marketingSequenceStepSplitTests &&
    dbStore.marketingSequenceAbAllocations
  ) {
    let splitTest = await dbStore.marketingSequenceStepSplitTests.findForStep(
      step.id,
    );
    if (splitTest && splitTest.isActive === 1) {
      if (
        splitTest.autoPromoteWinner === 1 &&
        dbStore.marketingSequenceMemberships &&
        dbStore.activities.findMany &&
        dbStore.activityLinks.findMany &&
        dbStore.emailTrackers?.findMany &&
        dbStore.marketingSequenceAbAllocations.findMany &&
        dbStore.marketingSequenceStepSplitTests.update
      ) {
        const seqMemberships =
          await dbStore.marketingSequenceMemberships.findMany();
        const relevantMembers = seqMemberships.filter(
          (m) => m.sequenceId === membership.sequenceId && m.orgId === orgId,
        );

        const stepAllocations =
          await dbStore.marketingSequenceAbAllocations.findMany();
        const relevantAllocs = stepAllocations.filter(
          (a) => a.stepId === step.id && a.orgId === orgId,
        );

        const activityLinks = await dbStore.activityLinks.findMany();
        const activities = await dbStore.activities.findMany();
        const emailTrackers = await dbStore.emailTrackers.findMany();

        const trackerByActivity = new Map<
          string,
          { openCount: number; clickCount: number }
        >();
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
          const alloc = relevantAllocs.find((a) => a.membershipId === m.id);
          if (!alloc) continue;

          const linksForRecord = activityLinks.filter(
            (link) =>
              link.targetId === m.recordId &&
              link.orgId === orgId &&
              (link.targetType === "Lead" || link.targetType === "Contact"),
          );
          const activityIds = linksForRecord.map((l) => l.activityId);
          const emailActs = activities.filter(
            (act) =>
              act.type === "email" &&
              act.orgId === orgId &&
              activityIds.includes(act.id),
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
            } else if (
              alloc.allocatedTemplateId === splitTest.variantTemplateId
            ) {
              variantSends++;
              if (isOpened) variantOpens++;
              if (isClicked) variantClicks++;
            }
          }
        }

        const totalSends = baseSends + variantSends;
        const minSends = splitTest.minSendsToEvaluate ?? 10;
        if (totalSends >= minSends) {
          let baseRate = 0;
          let variantRate = 0;
          const metric = splitTest.evaluationMetric || "open_rate";

          if (metric === "open_rate") {
            baseRate = baseSends > 0 ? baseOpens / baseSends : 0;
            variantRate = variantSends > 0 ? variantOpens / variantSends : 0;
          } else if (metric === "click_rate") {
            baseRate = baseSends > 0 ? baseClicks / baseSends : 0;
            variantRate = variantSends > 0 ? variantClicks / variantSends : 0;
          }

          let winnerTemplateId = step.templateId || "";
          let winnerLabel = "base";

          if (variantRate > baseRate) {
            winnerTemplateId = splitTest.variantTemplateId;
            winnerLabel = "variant";
          }

          await dbStore.marketingSequenceSteps.update(step.id, {
            templateId: winnerTemplateId,
          });

          await dbStore.marketingSequenceStepSplitTests.update(splitTest.id, {
            isActive: 0,
          });

          if (dbStore.auditLogs) {
            await dbStore.auditLogs.insert({
              orgId,
              recordId: splitTest.id,
              recordType: "marketing_sequence_step_split_tests",
              action: "auto_promoted",
              userId: "00000000-0000-0000-0000-000000000000",
              changes: {
                winnerTemplateId: {
                  before: step.templateId,
                  after: winnerTemplateId,
                },
                winnerLabel: { before: "none", after: winnerLabel },
                evaluationMetric: { before: null, after: metric },
                totalSends: { before: 0, after: totalSends },
                baseSends: { before: 0, after: baseSends },
                baseRate: { before: 0, after: baseRate },
                variantSends: { before: 0, after: variantSends },
                variantRate: { before: 0, after: variantRate },
              },
            });
          }

          splitTest = await dbStore.marketingSequenceStepSplitTests.findForStep(
            step.id,
          );
          step.templateId = winnerTemplateId;
          templateIdToUse = winnerTemplateId;
        }
      }

      if (splitTest && splitTest.isActive === 1) {
        const existingAlloc =
          await dbStore.marketingSequenceAbAllocations.findForMemberAndStep(
            membership.id,
            step.id,
          );
        if (existingAlloc) {
          templateIdToUse = existingAlloc.allocatedTemplateId;
        } else {
          const roll = Math.floor(Math.random() * 100) + 1;
          if (roll <= splitTest.splitWeight) {
            templateIdToUse = splitTest.variantTemplateId;
          } else {
            templateIdToUse = step.templateId || "";
          }
          await dbStore.marketingSequenceAbAllocations.insert({
            orgId,
            membershipId: membership.id,
            stepId: step.id,
            allocatedTemplateId: templateIdToUse,
          });
        }
      }
    }
  }

  const template = templateIdToUse
    ? await dbStore.emailTemplates.findOne(templateIdToUse)
    : null;
  if (!template) {
    await dbStore.marketingSequenceMemberships.update(membership.id, {
      status: "error",
    });
    return;
  }

  const compiled = compileEmailTemplate(template, recipientContext);

  let resolvedSenderId = "00000000-0000-0000-0000-000000000000";
  if (sequence) {
    const senderType = sequence.senderType || "system";
    if (senderType === "owner") {
      let recipient: { ownerId?: string } | null = null;
      if (membership.recordType === "lead" && dbStore.leads) {
        recipient = (await dbStore.leads.findOne(membership.recordId)) as {
          ownerId?: string;
        } | null;
      } else if (membership.recordType === "contact" && dbStore.contacts) {
        recipient = (await dbStore.contacts.findOne(membership.recordId)) as {
          ownerId?: string;
        } | null;
      }
      if (recipient?.ownerId) {
        resolvedSenderId = recipient.ownerId;
      }
    } else if (senderType === "specific" && sequence.senderUserId) {
      resolvedSenderId = sequence.senderUserId;
    }
  }

  let finalSubject = compiled.subject;
  const customAttributes: Record<string, unknown> = {};

  if (step.replyToStepNumber && step.replyToStepNumber >= 1) {
    const targetStep = steps.find(
      (s) =>
        s.sequenceId === step.sequenceId &&
        s.stepNumber === step.replyToStepNumber &&
        s.orgId === orgId,
    );

    if (targetStep) {
      const activities = (await dbStore.activities.findMany?.()) || [];
      const links = (await dbStore.activityLinks.findMany?.()) || [];

      const targetLinks = links.filter(
        (l) =>
          l.orgId === orgId &&
          l.targetType ===
            (membership.recordType === "lead" ? "Lead" : "Contact") &&
          l.targetId === membership.recordId,
      );

      const targetActivityIds = new Set(targetLinks.map((l) => l.activityId));
      const parentActivity = activities.find(
        (a) =>
          targetActivityIds.has(a.id) &&
          a.orgId === orgId &&
          a.type === "email" &&
          a.subject,
      );

      if (parentActivity) {
        const startsWithRe = /^re:/i.test(parentActivity.subject);
        finalSubject = startsWithRe
          ? parentActivity.subject
          : `Re: ${parentActivity.subject}`;

        customAttributes.parent_activity_id = parentActivity.id;
      }
    }
  }

  const activity = await dbStore.activities.insert({
    orgId,
    creatorId: resolvedSenderId,
    type: "email",
    subject: finalSubject,
    body: compiled.body,
    dueDate: null,
    createdAt: currentTime,
    custom: Object.keys(customAttributes).length > 0 ? customAttributes : null,
  });

  await dbStore.activityLinks.insert({
    orgId,
    activityId: activity.id,
    targetType: membership.recordType === "lead" ? "Lead" : "Contact",
    targetId: membership.recordId,
  });

  // Auto-generate email tracking record for task 0180
  // biome-ignore lint/suspicious/noExplicitAny: emailTrackers check
  if ((dbStore as any).emailTrackers) {
    const trackerToken = `seq-track-${uuidv7()}`;
    // biome-ignore lint/suspicious/noExplicitAny: emailTrackers insert
    await (dbStore as any).emailTrackers.insert({
      orgId,
      activityId: activity.id,
      token: trackerToken,
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
