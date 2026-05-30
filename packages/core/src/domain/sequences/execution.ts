import { v7 as uuidv7 } from "uuid";
import type {
  CoreAbAllocation,
  CoreActivity,
  CoreActivityLink,
  CoreConsentPreference,
  CoreEmailTracker,
  CoreExitTrigger,
  CoreSequence,
  CoreSequenceConversion,
  CoreSequenceExclusion,
  CoreSequenceGoal,
  CoreSequenceMembership,
  CoreSequenceStep,
  CoreSequenceSuppression,
  CoreStepBranch,
  CoreStepSplitTest,
} from "../../types";
import { compileEmailTemplate, personalizeEmailTemplate } from "../email";
import {
  calculateNextStepExecutionTime,
  getNextValidSendingTime,
  isRecordSuppressedOrExcluded,
} from "../shared";
import { evaluateSequenceGoals, shouldExitSequence } from "./enrollment";

export interface SequenceDbStore {
  marketingSequenceMemberships: {
    findMany: () => Promise<CoreSequenceMembership[]>;
    update: (
      id: string,
      updates: Partial<
        Omit<CoreSequenceMembership, "id" | "orgId" | "createdAt" | "updatedAt">
      >,
    ) => Promise<CoreSequenceMembership | null>;
  };
  marketingSequenceSteps: {
    findForSequence: (sequenceId: string) => Promise<CoreSequenceStep[]>;
    update: (
      id: string,
      updates: Partial<
        Omit<CoreSequenceStep, "id" | "orgId" | "createdAt" | "updatedAt">
      >,
    ) => Promise<CoreSequenceStep | null>;
  };
  leads: {
    findOne: (id: string) => Promise<unknown | null>;
  };
  contacts: {
    findOne: (id: string) => Promise<unknown | null>;
  };
  contactConsentPreferences: {
    findMany: () => Promise<CoreConsentPreference[]>;
  };
  emailTemplates: {
    findOne: (id: string) => Promise<{
      id: string;
      orgId: string;
      name: string;
      subject: string;
      body: string;
    } | null>;
  };
  activities: {
    insert: (item: {
      orgId: string;
      creatorId: string;
      type: "email" | "task" | "call" | "note" | "sms";
      subject: string;
      body: string;
      dueDate: Date | null;
      createdAt?: Date;
      custom?: Record<string, unknown> | null;
    }) => Promise<{ id: string }>;
    findMany?: () => Promise<CoreActivity[]>;
  };
  activityLinks: {
    insert: (item: {
      orgId: string;
      activityId: string;
      targetType: "Lead" | "Account" | "Contact" | "Opportunity" | "Campaign";
      targetId: string;
    }) => Promise<unknown>;
    findMany?: () => Promise<CoreActivityLink[]>;
  };
  emailTrackers?: {
    findMany: () => Promise<CoreEmailTracker[]>;
    insert?: (item: {
      orgId: string;
      activityId: string;
      token: string;
    }) => Promise<unknown>;
  };
  auditLogs: {
    insert: (item: {
      orgId: string;
      recordId: string;
      recordType: string;
      action: string;
      userId: string;
      changes: Record<string, { before: unknown; after: unknown }>;
    }) => Promise<unknown>;
  };
  marketingSequenceExitTriggers?: {
    findForSequence: (sequenceId: string) => Promise<CoreExitTrigger[]>;
  };
  opportunities?: {
    findMany: () => Promise<unknown[]>;
  };
  marketingSequenceStepSplitTests?: {
    findForStep: (stepId: string) => Promise<CoreStepSplitTest | null>;
    update?: (
      id: string,
      updates: Partial<
        Omit<CoreStepSplitTest, "id" | "orgId" | "createdAt" | "updatedAt">
      >,
    ) => Promise<CoreStepSplitTest | null>;
  };
  marketingSequenceAbAllocations?: {
    findForMemberAndStep: (
      membershipId: string,
      stepId: string,
    ) => Promise<CoreAbAllocation | null>;
    insert: (item: {
      orgId: string;
      membershipId: string;
      stepId: string;
      allocatedTemplateId: string;
    }) => Promise<CoreAbAllocation>;
    findMany?: () => Promise<CoreAbAllocation[]>;
  };
  marketingSequenceStepBranches?: {
    findForStep: (stepId: string) => Promise<CoreStepBranch | null>;
  };
  marketingSequenceGoals?: {
    findForSequence: (sequenceId: string) => Promise<CoreSequenceGoal[]>;
  };
  marketingSequenceConversions?: {
    insert: (item: {
      orgId: string;
      membershipId: string;
      sequenceId: string;
      goalId: string;
      attributedRevenue: string;
      convertedAt: Date;
    }) => Promise<CoreSequenceConversion>;
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
  webhookOutbox?: {
    // biome-ignore lint/suspicious/noExplicitAny: insert parameter type typing bypass
    insert: (item: any) => Promise<unknown>;
  };
  marketingSequences?: {
    findOne: (id: string) => Promise<CoreSequence | null>;
  };
  marketingSequenceCaps?: {
    findMany: () => Promise<
      {
        domainThrottleLimit: number;
        recipientFrequencyCap: number;
      }[]
    >;
  };
}

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

/**
 * Executes an SMS step type in the sequence.
 */
export async function executeSmsStep(
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

  if (dbStore.activities && step.smsMessage) {
    const personalized = personalizeEmailTemplate(
      { subject: "Outbound SMS", body: step.smsMessage },
      recipientContext,
    );

    const creatorId = "00000000-0000-0000-0000-000000000000";

    const act = await dbStore.activities.insert({
      orgId,
      creatorId,
      type: "sms",
      subject: personalized.subject,
      body: personalized.body,
      dueDate: null,
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

/**
 * Executes a call step type in the sequence.
 */
export async function executeCallStep(
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

  if (dbStore.activities && step.callScript) {
    const personalized = personalizeEmailTemplate(
      { subject: "Outbound Call", body: step.callScript },
      recipientContext,
    );

    const creatorId = "00000000-0000-0000-0000-000000000000";

    const act = await dbStore.activities.insert({
      orgId,
      creatorId,
      type: "call",
      subject: personalized.subject,
      body: personalized.body,
      dueDate: null,
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

export async function executePendingSequenceSteps(
  dbStore: SequenceDbStore,
  currentTime: Date = new Date(),
): Promise<number> {
  const memberships = await dbStore.marketingSequenceMemberships.findMany();

  const sequenceSendsToday = new Map<string, number>();

  function isSameDay(d1: Date, d2: Date): boolean {
    return (
      d1.getFullYear() === d2.getFullYear() &&
      d1.getMonth() === d2.getMonth() &&
      d1.getDate() === d2.getDate()
    );
  }

  for (const m of memberships) {
    if (
      m.lastExecutedAt &&
      isSameDay(new Date(m.lastExecutedAt), currentTime)
    ) {
      const count = sequenceSendsToday.get(m.sequenceId) || 0;
      sequenceSendsToday.set(m.sequenceId, count + 1);
    }
  }

  // Auto-resume memberships whose snooze period has expired
  for (const m of memberships) {
    if (
      m.status === "snoozed" &&
      m.snoozeUntil &&
      new Date(m.snoozeUntil) <= currentTime
    ) {
      const originalSnoozeUntil = m.snoozeUntil;
      await dbStore.marketingSequenceMemberships.update(m.id, {
        status: "active",
        snoozeUntil: null,
        snoozeReason: null,
        nextExecutionAt: currentTime,
      });

      // Update local object so it can be executed immediately in this cycle if eligible
      m.status = "active";
      m.snoozeUntil = null;
      m.snoozeReason = null;
      m.nextExecutionAt = currentTime;

      await dbStore.auditLogs.insert({
        orgId: m.orgId,
        recordId: m.id,
        recordType: "marketing_sequence_memberships",
        action: "membership_resumed",
        userId: "00000000-0000-0000-0000-000000000000",
        changes: {
          status: { before: "snoozed", after: "active" },
          snoozeUntil: {
            before: originalSnoozeUntil
              ? new Date(originalSnoozeUntil).toISOString()
              : null,
            after: null,
          },
        },
      });
    }
  }

  const pendingMemberships = memberships.filter(
    (m) => m.status === "active" && new Date(m.nextExecutionAt) <= currentTime,
  );

  let processedCount = 0;

  for (const membership of pendingMemberships) {
    const orgId = membership.orgId;

    let recipientTimezone: string | null = null;
    if (membership.recordType === "lead" && dbStore.leads) {
      // biome-ignore lint/suspicious/noExplicitAny: dbStore findOne returns unknown, casting to any is safe here
      const lead: any = await dbStore.leads.findOne(membership.recordId);
      if (lead?.custom?.timezone) {
        recipientTimezone = lead.custom.timezone;
      }
    } else if (membership.recordType === "contact" && dbStore.contacts) {
      // biome-ignore lint/suspicious/noExplicitAny: dbStore findOne returns unknown, casting to any is safe here
      const contact: any = await dbStore.contacts.findOne(membership.recordId);
      if (contact?.custom?.timezone) {
        recipientTimezone = contact.custom.timezone;
      }
    }

    let sequence: CoreSequence | null = null;
    if (dbStore.marketingSequences) {
      sequence = await dbStore.marketingSequences.findOne(
        membership.sequenceId,
      );
    }

    if (sequence) {
      if (sequence.status === "paused") {
        continue;
      }
      const validTime = getNextValidSendingTime(
        currentTime,
        sequence.sendingDays || null,
        sequence.sendingWindowStart || null,
        sequence.sendingWindowEnd || null,
        recipientTimezone,
      );
      if (validTime.getTime() > currentTime.getTime()) {
        const originalNext = membership.nextExecutionAt;
        await dbStore.marketingSequenceMemberships.update(membership.id, {
          nextExecutionAt: validTime,
        });
        await dbStore.auditLogs.insert({
          orgId: membership.orgId,
          recordId: membership.id,
          recordType: "marketing_sequence_memberships",
          action: "membership_schedule_deferred",
          userId: "00000000-0000-0000-0000-000000000000",
          changes: {
            nextExecutionAt: {
              before:
                originalNext instanceof Date
                  ? originalNext.toISOString()
                  : new Date(originalNext).toISOString(),
              after: validTime.toISOString(),
            },
          },
        });
        continue;
      }

      const dailyLimit = sequence.dailySendLimit;
      if (dailyLimit !== undefined && dailyLimit !== null && dailyLimit > 0) {
        const sentCount = sequenceSendsToday.get(membership.sequenceId) || 0;
        if (sentCount >= dailyLimit) {
          const validDeferredTime = new Date(
            currentTime.getTime() + 24 * 60 * 60 * 1000,
          );
          const originalNext = membership.nextExecutionAt;
          await dbStore.marketingSequenceMemberships.update(membership.id, {
            nextExecutionAt: validDeferredTime,
          });
          await dbStore.auditLogs.insert({
            orgId: membership.orgId,
            recordId: membership.id,
            recordType: "marketing_sequence_memberships",
            action: "membership_schedule_deferred",
            userId: "00000000-0000-0000-0000-000000000000",
            changes: {
              nextExecutionAt: {
                before:
                  originalNext instanceof Date
                    ? originalNext.toISOString()
                    : new Date(originalNext).toISOString(),
                after: validDeferredTime.toISOString(),
              },
              throttle_reason: {
                before: null,
                after: `Daily sending throttle reached: limit is ${dailyLimit}`,
              },
            },
          });
          continue;
        }
      }
    }

    let recipientEmail: string | null = null;
    if (membership.recordType === "lead" && dbStore.leads) {
      // biome-ignore lint/suspicious/noExplicitAny: casting is safe
      const lead: any = await dbStore.leads.findOne(membership.recordId);
      if (lead?.email) {
        recipientEmail = lead.email;
      }
    } else if (membership.recordType === "contact" && dbStore.contacts) {
      // biome-ignore lint/suspicious/noExplicitAny: casting is safe
      const contact: any = await dbStore.contacts.findOne(membership.recordId);
      if (contact?.email) {
        recipientEmail = contact.email;
      }
    }

    if (recipientEmail) {
      const domain = recipientEmail.split("@")[1]?.toLowerCase() || "";
      let domainLimit = 5;
      let recipientCap = 3;
      // biome-ignore lint/suspicious/noExplicitAny: casting is safe
      if ((dbStore as any).marketingSequenceCaps) {
        const capsList =
          await // biome-ignore lint/suspicious/noExplicitAny: casting is safe
          (dbStore as any).marketingSequenceCaps.findMany();
        if (capsList && capsList.length > 0) {
          domainLimit = capsList[0].domainThrottleLimit;
          recipientCap = capsList[0].recipientFrequencyCap;
        }
      }

      const activities = dbStore.activities.findMany
        ? await dbStore.activities.findMany()
        : [];
      const links = dbStore.activityLinks.findMany
        ? await dbStore.activityLinks.findMany()
        : [];

      const oneDayAgo = new Date(currentTime.getTime() - 24 * 60 * 60 * 1000);
      const sevenDaysAgo = new Date(
        currentTime.getTime() - 7 * 24 * 60 * 60 * 1000,
      );

      let domainSentCount = 0;
      let recipientSentCount = 0;

      for (const act of activities) {
        if (act.orgId !== orgId || act.type !== "email") continue;
        const actTime = new Date(act.createdAt);

        if (actTime >= sevenDaysAgo && actTime <= currentTime) {
          const hasLink = links.some(
            (l) =>
              l.activityId === act.id &&
              l.targetId === membership.recordId &&
              l.targetType.toLowerCase() ===
                membership.recordType.toLowerCase(),
          );
          if (hasLink) {
            recipientSentCount++;
          }
        }

        if (actTime >= oneDayAgo && actTime <= currentTime) {
          const actLinksForActivity = links.filter(
            (l) => l.activityId === act.id,
          );
          for (const link of actLinksForActivity) {
            let linkedEmail: string | null = null;
            if (link.targetType === "Lead" && dbStore.leads) {
              // biome-ignore lint/suspicious/noExplicitAny: casting is safe
              const lead: any = await dbStore.leads.findOne(link.targetId);
              if (lead?.email) {
                linkedEmail = lead.email;
              }
            } else if (link.targetType === "Contact" && dbStore.contacts) {
              // biome-ignore lint/suspicious/noExplicitAny: casting is safe
              const contact: any = await dbStore.contacts.findOne(
                link.targetId,
              );
              if (contact?.email) {
                linkedEmail = contact.email;
              }
            }
            if (linkedEmail) {
              const linkedDomain =
                linkedEmail.split("@")[1]?.toLowerCase() || "";
              if (linkedDomain === domain) {
                domainSentCount++;
                break;
              }
            }
          }
        }
      }

      if (domainSentCount >= domainLimit) {
        const nextExec = new Date(currentTime.getTime() + 24 * 60 * 60 * 1000);
        await dbStore.marketingSequenceMemberships.update(membership.id, {
          nextExecutionAt: nextExec,
        });
        await dbStore.auditLogs.insert({
          orgId,
          recordId: membership.id,
          recordType: "marketing_sequence_memberships",
          action: "deferred_domain_throttle",
          userId: "00000000-0000-0000-0000-000000000000",
          changes: {
            domain: { before: null, after: domain },
            sentCount: { before: null, after: domainSentCount },
            limit: { before: null, after: domainLimit },
            nextExecutionAt: {
              before: new Date(membership.nextExecutionAt).toISOString(),
              after: nextExec.toISOString(),
            },
          },
        });
        continue;
      }

      if (recipientSentCount >= recipientCap) {
        const nextExec = new Date(currentTime.getTime() + 24 * 60 * 60 * 1000);
        await dbStore.marketingSequenceMemberships.update(membership.id, {
          nextExecutionAt: nextExec,
        });
        await dbStore.auditLogs.insert({
          orgId,
          recordId: membership.id,
          recordType: "marketing_sequence_memberships",
          action: "deferred_frequency_cap",
          userId: "00000000-0000-0000-0000-000000000000",
          changes: {
            recipient: { before: null, after: recipientEmail },
            sentCount: { before: null, after: recipientSentCount },
            limit: { before: null, after: recipientCap },
            nextExecutionAt: {
              before: new Date(membership.nextExecutionAt).toISOString(),
              after: nextExec.toISOString(),
            },
          },
        });
        continue;
      }
    }

    const steps = await dbStore.marketingSequenceSteps.findForSequence(
      membership.sequenceId,
    );

    let recipientContext: {
      lead?: Record<string, unknown> | null;
      contact?: Record<string, unknown> | null;
    } = {};

    if (membership.recordType === "lead") {
      const lead = await dbStore.leads.findOne(membership.recordId);
      if (lead) {
        recipientContext = { lead: lead as Record<string, unknown> };
      }
    } else if (membership.recordType === "contact") {
      const contact = await dbStore.contacts.findOne(membership.recordId);
      if (contact) {
        recipientContext = { contact: contact as Record<string, unknown> };
      }
    }

    if (
      dbStore.marketingSequenceSuppressions &&
      dbStore.marketingSequenceExclusions
    ) {
      const recordEmail =
        membership.recordType === "lead"
          ? (recipientContext.lead?.email as string | undefined)
          : (recipientContext.contact?.email as string | undefined);
      const suppressionStatus = await isRecordSuppressedOrExcluded({
        orgId,
        sequenceId: membership.sequenceId,
        recordType: membership.recordType,
        recordId: membership.recordId,
        email: recordEmail,
        // biome-ignore lint/suspicious/noExplicitAny: dbStore type alignment
        dbStore: dbStore as any,
      });

      if (suppressionStatus.suppressed) {
        await dbStore.marketingSequenceMemberships.update(membership.id, {
          status: "suppressed",
        });

        await dbStore.auditLogs.insert({
          orgId,
          recordId: membership.id,
          recordType: "marketing_sequence_memberships",
          action: "membership_suppressed",
          userId: "00000000-0000-0000-0000-000000000000",
          changes: {
            status: { before: "active", after: "suppressed" },
          },
        });

        processedCount++;
        continue;
      }
    }

    if (
      dbStore.marketingSequenceGoals &&
      dbStore.marketingSequenceConversions
    ) {
      const goalConverted = await evaluateSequenceGoals(
        dbStore,
        orgId,
        membership,
        recipientContext,
      );
      if (goalConverted) {
        processedCount++;
        continue;
      }
    }

    // Evaluate branching condition
    const nextStepNumber = await executeBranchStep(dbStore, membership, steps);

    const step = steps.find((s) => s.stepNumber === nextStepNumber);

    if (!step) {
      await dbStore.marketingSequenceMemberships.update(membership.id, {
        status: "completed",
        currentStepNumber: membership.currentStepNumber,
      });
      processedCount++;
      continue;
    }

    // Evaluate Exit Triggers if the stores are provided
    if (dbStore.marketingSequenceExitTriggers && dbStore.opportunities) {
      const triggers =
        await dbStore.marketingSequenceExitTriggers.findForSequence(
          membership.sequenceId,
        );
      const allOpps = (await dbStore.opportunities.findMany()) as Record<
        string,
        unknown
      >[];
      let relevantOpps: Record<string, unknown>[] = [];
      if (membership.recordType === "contact" && recipientContext.contact) {
        const contactAccountId = (
          recipientContext.contact as Record<string, unknown>
        ).accountId as string | undefined;
        if (contactAccountId) {
          relevantOpps = allOpps.filter(
            (opp) => opp.accountId === contactAccountId,
          );
        }
      }

      if (
        shouldExitSequence({
          recordType: membership.recordType,
          lead: recipientContext.lead,
          opportunities: relevantOpps,
          triggers,
        })
      ) {
        await dbStore.marketingSequenceMemberships.update(membership.id, {
          status: "completed",
        });

        await dbStore.auditLogs.insert({
          orgId,
          recordId: membership.id,
          recordType: "marketing_sequence_memberships",
          action: "exit_trigger_fired",
          userId: "00000000-0000-0000-0000-000000000000",
          changes: {
            status: { before: "active", after: "completed" },
          },
        });

        processedCount++;
        continue;
      }
    }

    const allPrefs = await dbStore.contactConsentPreferences.findMany();
    const existingPref = allPrefs.find(
      (p) =>
        p.recordType === membership.recordType &&
        p.recordId === membership.recordId &&
        p.channel === "email" &&
        p.status === "opt_out",
    );

    if (existingPref) {
      await dbStore.marketingSequenceMemberships.update(membership.id, {
        status: "unsubscribed",
      });

      await dbStore.auditLogs.insert({
        orgId,
        recordId: membership.recordId,
        recordType: "marketing_sequence_memberships",
        action: "unsubscribe_skip",
        userId: "00000000-0000-0000-0000-000000000000",
        changes: {
          status: { before: "active", after: "unsubscribed" },
        },
      });

      processedCount++;
      continue;
    }

    // Dispatch to step-type handler
    if (step.stepType === "task") {
      await executeTaskStep(
        dbStore,
        membership,
        step,
        steps,
        currentTime,
        recipientContext,
        nextStepNumber,
        sequenceSendsToday,
      );
    } else if (step.stepType === "sms") {
      await executeSmsStep(
        dbStore,
        membership,
        step,
        steps,
        currentTime,
        recipientContext,
        nextStepNumber,
        sequenceSendsToday,
      );
    } else if (step.stepType === "call") {
      await executeCallStep(
        dbStore,
        membership,
        step,
        steps,
        currentTime,
        recipientContext,
        nextStepNumber,
        sequenceSendsToday,
      );
    } else if (step.stepType === "webhook") {
      await executeWebhookStep(
        dbStore,
        membership,
        step,
        steps,
        currentTime,
        recipientContext,
        nextStepNumber,
        sequenceSendsToday,
        recipientEmail,
      );
    } else if (step.stepType === "email" || !step.stepType) {
      await executeEmailStep(
        dbStore,
        membership,
        step,
        steps,
        currentTime,
        recipientContext,
        nextStepNumber,
        sequenceSendsToday,
        sequence,
      );
    }

    processedCount++;
  }

  return processedCount;
}
