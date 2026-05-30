import { v7 as uuidv7 } from "uuid";
import type {
  ActivityLogEntry,
  BounceAnalyticsInput,
  BounceAnalyticsResult,
  BounceTypePerformanceMetric,
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
  DevicePerformanceMetric,
  EventRecord,
  OpenAnalyticsInput,
  OpenAnalyticsResult,
  ReadTimeAnalyticsInput,
  ReadTimeAnalyticsResult,
  ReadTimePerformanceMetric,
  ReplyAnalyticsInput,
  ReplyAnalyticsResult,
  SentimentPerformanceMetric,
  SequenceAnalyticsResult,
  StepAnalytics,
  StepBounceRateMetric,
  StepOpenRateMetric,
  StepReadTimeStatsMetric,
  StepReplyRateMetric,
  UnsubscribeAnalyticsInput,
  UnsubscribeAnalyticsResult,
} from "../../types";
import { compileEmailTemplate, personalizeEmailTemplate } from "../email";
import {
  calculateNextStepExecutionTime,
  getNextValidSendingTime,
  isRecordSuppressedOrExcluded,
} from "../shared";

export function shouldExitSequence(params: {
  recordType: "lead" | "contact";
  lead: Record<string, unknown> | null | undefined;
  opportunities: Record<string, unknown>[];
  triggers: CoreExitTrigger[];
}): boolean {
  for (const trigger of params.triggers) {
    if (trigger.isActive !== 1) continue;

    if (
      trigger.triggerType === "lead_status_changed" &&
      params.recordType === "lead" &&
      params.lead
    ) {
      const targetStatus = trigger.criteria?.status;
      if (targetStatus && params.lead.status === targetStatus) {
        return true;
      }
    }

    if (
      trigger.triggerType === "opportunity_stage_changed" &&
      params.recordType === "contact"
    ) {
      const targetStage = trigger.criteria?.stage;
      if (targetStage) {
        const hasMatchingOpp = params.opportunities.some(
          (opp) => opp.stage === targetStage,
        );
        if (hasMatchingOpp) {
          return true;
        }
      }
    }
  }
  return false;
}

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
  // Check for existing memberships to enforce active protection, re-enrollment, and frequency limits
  if (dbStore.marketingSequenceMemberships.findMany) {
    const existing = await dbStore.marketingSequenceMemberships.findMany();
    const recipientMemberships = existing.filter(
      (m) =>
        m.sequenceId === sequenceId &&
        m.recordType === recordType &&
        m.recordId === recordId,
    );

    // 1. Prevent overlapping active/snoozed enrollments
    const active = recipientMemberships.find(
      (m) => m.status === "active" || m.status === "snoozed",
    );
    if (active) {
      throw new Error(
        "Recipient is already actively enrolled in this sequence",
      );
    }

    // 2. Enforce re-enrollment rules
    if (dbStore.marketingSequences) {
      const seq = await dbStore.marketingSequences.findOne(sequenceId);
      if (!seq) {
        throw new Error("Sequence not found");
      }
      if (seq.orgId !== orgId) {
        throw new Error("RLS Isolation Violation: Tenant mismatch.");
      }
      if (seq.status === "archived") {
        throw new Error("Cannot enroll in an archived sequence");
      }

      const allowReenroll = seq.allowReenrollment ?? false;
      if (!allowReenroll && recipientMemberships.length > 0) {
        throw new Error("Re-enrollment is not allowed for this sequence");
      }

      if (
        allowReenroll &&
        seq.reenrollmentMinDays &&
        seq.reenrollmentMinDays > 0
      ) {
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
  let email: string | undefined;
  if (dbStore.leads && recordType === "lead") {
    const lead = (await dbStore.leads.findOne(recordId)) as Record<
      string,
      unknown
    > | null;
    if (!lead) {
      throw new Error("Lead not found");
    }
    email = lead.email as string | undefined;
  } else if (dbStore.contacts && recordType === "contact") {
    const contact = (await dbStore.contacts.findOne(recordId)) as Record<
      string,
      unknown
    > | null;
    if (!contact) {
      throw new Error("Contact not found");
    }
    email = contact.email as string | undefined;
  }

  let isSuppressed = false;
  if (
    dbStore.marketingSequenceSuppressions &&
    dbStore.marketingSequenceExclusions
  ) {
    const suppResult = await isRecordSuppressedOrExcluded({
      orgId,
      sequenceId,
      recordType,
      recordId,
      email,
      // biome-ignore lint/suspicious/noExplicitAny: dbStore type alignment
      dbStore: dbStore as any,
    });
    isSuppressed = suppResult.suppressed;
  }

  const steps =
    await dbStore.marketingSequenceSteps.findForSequence(sequenceId);
  const firstStep = steps.find((s) => s.stepNumber === 1);
  const delay = firstStep ? firstStep.delayDays : 0;

  // Compute nextExecutionAt: delay represented in days
  const nextExecutionAt = new Date(Date.now() + delay * 24 * 60 * 60 * 1000);

  const membership = await dbStore.marketingSequenceMemberships.insert({
    orgId,
    sequenceId,
    recordType,
    recordId,
    status: isSuppressed ? "suppressed" : "active",
    currentStepNumber: 0,
    lastExecutedAt: null,
    nextExecutionAt,
    snoozeUntil: null,
    snoozeReason: null,
  });

  return membership;
}

export async function evaluateSequenceGoals(
  dbStore: {
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
    marketingSequenceMemberships: {
      update: (
        id: string,
        updates: Partial<
          Omit<
            CoreSequenceMembership,
            "id" | "orgId" | "createdAt" | "updatedAt"
          >
        >,
      ) => Promise<CoreSequenceMembership | null>;
    };
    opportunities?: {
      findMany: () => Promise<unknown[]>;
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
  },
  orgId: string,
  membership: CoreSequenceMembership,
  recipientContext: {
    lead?: Record<string, unknown> | null;
    contact?: Record<string, unknown> | null;
  },
): Promise<boolean> {
  if (
    !dbStore.marketingSequenceGoals ||
    !dbStore.marketingSequenceConversions
  ) {
    return false;
  }

  const goals = await dbStore.marketingSequenceGoals.findForSequence(
    membership.sequenceId,
  );
  const activeGoals = goals.filter((g) => g.isActive === 1);
  if (activeGoals.length === 0) return false;

  for (const goal of activeGoals) {
    let achieved = false;
    let revenue = "0.00";

    if (
      goal.goalType === "lead_status_equals" &&
      membership.recordType === "lead" &&
      recipientContext.lead
    ) {
      if (recipientContext.lead.status === goal.targetValue) {
        achieved = true;
      }
    } else if (goal.goalType === "opportunity_created") {
      if (!dbStore.opportunities) continue;
      const allOpps = (await dbStore.opportunities.findMany()) as Record<
        string,
        unknown
      >[];
      let relevantOpps: Record<string, unknown>[] = [];
      if (membership.recordType === "lead") {
        relevantOpps = allOpps.filter(
          (opp) =>
            (opp.custom as Record<string, unknown> | null)?.sourceLeadId ===
            membership.recordId,
        );
      } else if (
        membership.recordType === "contact" &&
        recipientContext.contact
      ) {
        const contactAccountId = recipientContext.contact.accountId;
        if (contactAccountId) {
          relevantOpps = allOpps.filter(
            (opp) => opp.accountId === contactAccountId,
          );
        }
      }

      if (relevantOpps.length > 0) {
        achieved = true;
        const totalAmt = relevantOpps.reduce((sum, opp) => {
          const amt = Number.parseFloat(String(opp.amount || "0.00"));
          return sum + (Number.isNaN(amt) ? 0 : amt);
        }, 0);
        revenue = totalAmt.toFixed(2);
      }
    }

    if (achieved) {
      // Update status to converted
      await dbStore.marketingSequenceMemberships.update(membership.id, {
        status: "converted",
      });

      // Insert conversion log
      await dbStore.marketingSequenceConversions.insert({
        orgId,
        membershipId: membership.id,
        sequenceId: membership.sequenceId,
        goalId: goal.id,
        attributedRevenue: revenue,
        convertedAt: new Date(),
      });

      // Insert audit log
      await dbStore.auditLogs.insert({
        orgId,
        recordId: membership.id,
        recordType: "marketing_sequence_memberships",
        action: "goal_conversion",
        userId: "00000000-0000-0000-0000-000000000000",
        changes: {
          status: { before: membership.status, after: "converted" },
          attributedRevenue: { before: null, after: revenue },
        },
      });

      return true;
    }
  }

  return false;
}

export async function executePendingSequenceSteps(
  dbStore: {
    marketingSequenceMemberships: {
      findMany: () => Promise<CoreSequenceMembership[]>;
      update: (
        id: string,
        updates: Partial<
          Omit<
            CoreSequenceMembership,
            "id" | "orgId" | "createdAt" | "updatedAt"
          >
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
  },
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

    let nextStepNumber = membership.currentStepNumber + 1;

    // Check if the current step has a branching rule to evaluate
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
          // Evaluate branching condition
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

            splitTest =
              await dbStore.marketingSequenceStepSplitTests.findForStep(
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

    if (step.stepType === "task") {
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

      let nextStatus = "active";
      let nextExecTime = new Date();

      const stepJustExecuted = steps.find(
        (s) => s.stepNumber === nextStepNumber,
      );
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
        orgId,
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

      processedCount++;
      continue;
    }

    if (step.stepType === "sms") {
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

      let nextStatus = "active";
      let nextExecTime = new Date();

      const stepJustExecuted = steps.find(
        (s) => s.stepNumber === nextStepNumber,
      );
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
        orgId,
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

      processedCount++;
      continue;
    }

    if (step.stepType === "call") {
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

      let nextStatus = "active";
      let nextExecTime = new Date();

      const stepJustExecuted = steps.find(
        (s) => s.stepNumber === nextStepNumber,
      );
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
        orgId,
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

      processedCount++;
      continue;
    }

    if (step.stepType === "webhook") {
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

      let nextStatus = "active";
      let nextExecTime = new Date();

      const stepJustExecuted = steps.find(
        (s) => s.stepNumber === nextStepNumber,
      );
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
        orgId,
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

      processedCount++;
      continue;
    }

    const template = templateIdToUse
      ? await dbStore.emailTemplates.findOne(templateIdToUse)
      : null;
    if (!template) {
      await dbStore.marketingSequenceMemberships.update(membership.id, {
        status: "error",
      });
      processedCount++;
      continue;
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
      custom:
        Object.keys(customAttributes).length > 0 ? customAttributes : null,
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
      orgId,
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

    processedCount++;
  }

  return processedCount;
}

export function evaluateSegmentCriteria(
  record: Record<string, unknown>,
  criteria: { field: string; operator: string; value: string }[],
): boolean {
  for (const cond of criteria) {
    let val: unknown;
    if (cond.field.startsWith("custom.")) {
      const customField = cond.field.substring("custom.".length);
      val = (record.custom as Record<string, unknown> | null)?.[customField];
    } else {
      val = record[cond.field];
    }

    if (val === undefined || val === null) {
      return false;
    }

    const valStr = String(val).toLowerCase();
    const condStr = String(cond.value).toLowerCase();

    if (cond.operator === "equals") {
      if (valStr !== condStr) return false;
    } else if (cond.operator === "not_equal") {
      if (valStr === condStr) return false;
    } else if (cond.operator === "contains") {
      if (!valStr.includes(condStr)) return false;
    } else if (cond.operator === "greater_than") {
      const vNum = Number.parseFloat(valStr);
      const cNum = Number.parseFloat(condStr);
      if (Number.isNaN(vNum) || Number.isNaN(cNum) || vNum <= cNum)
        return false;
    } else if (cond.operator === "less_than") {
      const vNum = Number.parseFloat(valStr);
      const cNum = Number.parseFloat(condStr);
      if (Number.isNaN(vNum) || Number.isNaN(cNum) || vNum >= cNum)
        return false;
    } else {
      return false;
    }
  }
  return true;
}

export async function resolveSegmentMembers(
  // biome-ignore lint/suspicious/noExplicitAny: dbStore dynamic reference
  db: any,
  _tenantOrgId: string,
  segmentId: string,
  // biome-ignore lint/suspicious/noExplicitAny: dynamic return
): Promise<any[]> {
  const segment = await db.marketingSegments.findOne(segmentId);
  if (!segment) {
    throw new Error("Segment not found");
  }

  if (segment.objectType === "lead") {
    const leads = await db.leads.findMany();
    // biome-ignore lint/suspicious/noExplicitAny: lead typecast
    return leads.filter((l: any) =>
      evaluateSegmentCriteria(l, segment.criteria),
    );
  }

  const contacts = await db.contacts.findMany();
  // biome-ignore lint/suspicious/noExplicitAny: contact typecast
  return contacts.filter((c: any) =>
    evaluateSegmentCriteria(c, segment.criteria),
  );
}

export async function enrollSegmentInSequence(
  // biome-ignore lint/suspicious/noExplicitAny: dbStore dynamic reference
  dbStore: any,
  orgId: string,
  segmentId: string,
  sequenceId: string,
): Promise<{
  enrolledCount: number;
  skippedCount: number;
  // biome-ignore lint/suspicious/noExplicitAny: dynamic return
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

  // 1. Resolve segment members
  const members = await resolveSegmentMembers(dbStore, orgId, segmentId);

  // 2. Fetch existing active memberships in target sequence
  const existingMemberships =
    await dbStore.marketingSequenceMemberships.findForSequence(sequenceId);
  const activeRecordIds = new Set(
    existingMemberships
      .filter((m: CoreSequenceMembership) => m.status === "active")
      .map((m: CoreSequenceMembership) => m.recordId),
  );

  // 3. Enroll non-duplicate members
  const newlyEnrolled: CoreSequenceMembership[] = [];
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

export function calculateSequenceAnalytics(params: {
  sequenceId: string;
  steps: { id: string; stepNumber: number; templateId: string | null }[];
  memberships: {
    sequenceId: string;
    status: string;
    currentStepNumber: number;
    recordId: string;
    recordType: string;
  }[];
  activities: { id: string; type: string }[];
  activityLinks: { activityId: string; targetId: string; targetType: string }[];
  emailTrackers: {
    activityId: string;
    openCount: number;
    clickCount: number;
  }[];
}): SequenceAnalyticsResult {
  const {
    sequenceId,
    steps,
    memberships,
    activities,
    activityLinks,
    emailTrackers,
  } = params;

  const seqMemberships = memberships.filter((m) => m.sequenceId === sequenceId);
  const totalEnrolled = seqMemberships.length;

  const statusCounts = {
    active: 0,
    completed: 0,
    unsubscribed: 0,
    error: 0,
  };

  for (const m of seqMemberships) {
    if (m.status === "active") statusCounts.active++;
    else if (m.status === "completed") statusCounts.completed++;
    else if (m.status === "unsubscribed") statusCounts.unsubscribed++;
    else if (m.status === "error") statusCounts.error++;
  }

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

  const stepStats = new Map<
    number,
    { sentCount: number; openCount: number; clickCount: number }
  >();
  for (const step of steps) {
    stepStats.set(step.stepNumber, {
      sentCount: 0,
      openCount: 0,
      clickCount: 0,
    });
  }

  for (const m of seqMemberships) {
    const linksForRecord = activityLinks.filter(
      (link) =>
        link.targetId === m.recordId &&
        (link.targetType === "Lead" || link.targetType === "Contact"),
    );
    const activityIds = linksForRecord.map((l) => l.activityId);
    const emailActs = activities.filter(
      (act) => act.type === "email" && activityIds.includes(act.id),
    );
    emailActs.sort((a, b) => a.id.localeCompare(b.id));

    emailActs.forEach((act, idx) => {
      const stepNum = idx + 1;
      const stats = stepStats.get(stepNum);
      if (stats) {
        stats.sentCount++;
        const tracker = trackerByActivity.get(act.id);
        if (tracker) {
          stats.openCount += tracker.openCount;
          stats.clickCount += tracker.clickCount;
        }
      }
    });
  }

  let totalSent = 0;
  let totalOpens = 0;
  let totalClicks = 0;

  const stepAnalyticsList: StepAnalytics[] = steps.map((step) => {
    const stats = stepStats.get(step.stepNumber) || {
      sentCount: 0,
      openCount: 0,
      clickCount: 0,
    };
    totalSent += stats.sentCount;
    totalOpens += stats.openCount;
    totalClicks += stats.clickCount;

    const openRate =
      stats.sentCount > 0
        ? ((stats.openCount / stats.sentCount) * 100).toFixed(2)
        : "0.00";
    const clickRate =
      stats.sentCount > 0
        ? ((stats.clickCount / stats.sentCount) * 100).toFixed(2)
        : "0.00";

    return {
      stepNumber: step.stepNumber,
      templateId: step.templateId,
      sentCount: stats.sentCount,
      openCount: stats.openCount,
      clickCount: stats.clickCount,
      openRate: `${openRate}%`,
      clickRate: `${clickRate}%`,
    };
  });

  const overallOpenRate =
    totalSent > 0 ? ((totalOpens / totalSent) * 100).toFixed(2) : "0.00";
  const overallClickRate =
    totalSent > 0 ? ((totalClicks / totalSent) * 100).toFixed(2) : "0.00";

  return {
    sequenceId,
    totalEnrolled,
    statusCounts,
    overallOpenRate: `${overallOpenRate}%`,
    overallClickRate: `${overallClickRate}%`,
    steps: stepAnalyticsList,
  };
}

export async function processSequenceLinkClick(
  // biome-ignore lint/suspicious/noExplicitAny: dynamic store
  dbStore: any,
  orgId: string,
  activityId: string,
  clickedUrl: string,
  currentTime: Date = new Date(),
): Promise<number> {
  const links = (await dbStore.activityLinks.findMany()) as {
    activityId: string;
    orgId: string;
    targetType: "Lead" | "Contact" | "Opportunity" | "Account" | "Campaign";
    targetId: string;
  }[];
  const actLink = links.find(
    (l) =>
      l.activityId === activityId &&
      l.orgId === orgId &&
      (l.targetType.toLowerCase() === "lead" ||
        l.targetType.toLowerCase() === "contact"),
  );
  if (!actLink) return 0;

  const memberships =
    (await dbStore.marketingSequenceMemberships.findMany()) as {
      id: string;
      recordId: string;
      recordType: string;
      orgId: string;
      status: string;
      sequenceId: string;
    }[];
  const recordTypeLower = actLink.targetType.toLowerCase();
  const membership = memberships.find(
    (m) =>
      m.recordId === actLink.targetId &&
      m.recordType === recordTypeLower &&
      m.orgId === orgId &&
      (m.status === "active" || m.status === "completed"),
  );
  if (!membership) return 0;

  // Fetch all activities for this recipient, filter by email type, and sort by ID
  const allActs = (await dbStore.activities.findMany()) as {
    id: string;
    type: string;
    orgId: string;
  }[];
  const recipientActivityIds = new Set(
    links
      .filter(
        (l) =>
          l.targetId === actLink.targetId &&
          l.targetType.toLowerCase() === recordTypeLower &&
          l.orgId === orgId,
      )
      .map((l) => l.activityId),
  );

  const emailActs = allActs.filter(
    (act) =>
      act.type === "email" &&
      act.orgId === orgId &&
      recipientActivityIds.has(act.id),
  );
  emailActs.sort((a, b) => a.id.localeCompare(b.id));

  // Determine which step this is
  const clickedIdx = emailActs.findIndex((act) => act.id === activityId);
  if (clickedIdx === -1) return 0;
  const stepNumber = clickedIdx + 1;

  const steps = (await dbStore.marketingSequenceSteps.findForSequence(
    membership.sequenceId,
  )) as { id: string; stepNumber: number; orgId: string }[];
  const step = steps.find(
    (s) => s.stepNumber === stepNumber && s.orgId === orgId,
  );
  if (!step) return 0;

  const actions = (await dbStore.marketingSequenceLinkActions.findForStep(
    step.id,
  )) as {
    orgId: string;
    targetUrl: string;
    actionType: string;
    actionConfig: {
      field?: string;
      value?: string;
      subject?: string;
      body?: string | null;
      dueDateOffsetDays?: number;
    };
  }[];
  const matchingActions = actions.filter(
    (act) =>
      act.orgId === orgId &&
      (act.targetUrl === clickedUrl || act.targetUrl === "*"),
  );

  let executedCount = 0;
  for (const act of matchingActions) {
    if (act.actionType === "field_update") {
      const field = act.actionConfig?.field;
      const value = act.actionConfig?.value;
      if (field && value !== undefined) {
        if (recordTypeLower === "lead" && dbStore.leads) {
          const lead = await dbStore.leads.findOne(actLink.targetId);
          if (lead) {
            // biome-ignore lint/suspicious/noExplicitAny: casting safe
            const leadAny = lead as any;
            const beforeVal = field.startsWith("custom.")
              ? (leadAny.custom as Record<string, unknown>)?.[
                  field.substring(7)
                ]
              : leadAny[field];

            if (field.startsWith("custom.")) {
              const customField = field.substring(7);
              const newCustom = {
                ...(leadAny.custom || {}),
                [customField]: value,
              };
              await dbStore.leads.update(actLink.targetId, {
                custom: newCustom,
              });
            } else {
              await dbStore.leads.update(actLink.targetId, { [field]: value });
            }

            await dbStore.auditLogs.insert({
              orgId,
              recordId: actLink.targetId,
              recordType: "lead",
              action: "link_trigger_field_update",
              userId: "00000000-0000-0000-0000-000000000000",
              changes: {
                [field]: { before: beforeVal, after: value },
              },
            });
            executedCount++;
          }
        } else if (recordTypeLower === "contact" && dbStore.contacts) {
          const contact = await dbStore.contacts.findOne(actLink.targetId);
          if (contact) {
            // biome-ignore lint/suspicious/noExplicitAny: casting safe
            const contactAny = contact as any;
            const beforeVal = field.startsWith("custom.")
              ? (contactAny.custom as Record<string, unknown>)?.[
                  field.substring(7)
                ]
              : contactAny[field];

            if (field.startsWith("custom.")) {
              const customField = field.substring(7);
              const newCustom = {
                ...(contactAny.custom || {}),
                [customField]: value,
              };
              await dbStore.contacts.update(actLink.targetId, {
                custom: newCustom,
              });
            } else {
              await dbStore.contacts.update(actLink.targetId, {
                [field]: value,
              });
            }

            await dbStore.auditLogs.insert({
              orgId,
              recordId: actLink.targetId,
              recordType: "contact",
              action: "link_trigger_field_update",
              userId: "00000000-0000-0000-0000-000000000000",
              changes: {
                [field]: { before: beforeVal, after: value },
              },
            });
            executedCount++;
          }
        }
      }
    } else if (act.actionType === "create_task") {
      const subject = act.actionConfig?.subject || "Follow up";
      const body = act.actionConfig?.body || null;
      const offsetDays = act.actionConfig?.dueDateOffsetDays || 0;
      const dueDate = new Date(
        currentTime.getTime() + offsetDays * 24 * 60 * 60 * 1000,
      );

      const task = await dbStore.activities.insert({
        orgId,
        creatorId: "00000000-0000-0000-0000-000000000000",
        type: "task",
        subject,
        body,
        dueDate,
        createdAt: currentTime,
      });

      await dbStore.activityLinks.insert({
        orgId,
        activityId: task.id,
        targetType: actLink.targetType,
        targetId: actLink.targetId,
      });

      await dbStore.auditLogs.insert({
        orgId,
        recordId: membership.id,
        recordType: "marketing_sequence_memberships",
        action: "link_trigger_create_task",
        userId: "00000000-0000-0000-0000-000000000000",
        changes: {
          taskId: { before: null, after: task.id },
          subject: { before: null, after: subject },
        },
      });
      executedCount++;
    }
  }

  if (executedCount > 0) {
    await dbStore.auditLogs.insert({
      orgId,
      recordId: membership.id,
      recordType: "marketing_sequence_memberships",
      action: "link_trigger_executed",
      userId: "00000000-0000-0000-0000-000000000000",
      changes: {
        executedActionsCount: { before: 0, after: executedCount },
        clickedUrl: { before: null, after: clickedUrl },
      },
    });
  }

  return executedCount;
}

export async function processSequenceEmailOpen(
  // biome-ignore lint/suspicious/noExplicitAny: dynamic store
  dbStore: any,
  orgId: string,
  activityId: string,
  currentTime: Date = new Date(),
): Promise<number> {
  const links = (await dbStore.activityLinks.findMany()) as {
    activityId: string;
    orgId: string;
    targetType: "Lead" | "Contact" | "Opportunity" | "Account" | "Campaign";
    targetId: string;
  }[];
  const actLink = links.find(
    (l) =>
      l.activityId === activityId &&
      l.orgId === orgId &&
      (l.targetType.toLowerCase() === "lead" ||
        l.targetType.toLowerCase() === "contact"),
  );
  if (!actLink) return 0;

  const memberships =
    (await dbStore.marketingSequenceMemberships.findMany()) as {
      id: string;
      recordId: string;
      recordType: string;
      orgId: string;
      status: string;
      sequenceId: string;
    }[];
  const recordTypeLower = actLink.targetType.toLowerCase();
  const membership = memberships.find(
    (m) =>
      m.recordId === actLink.targetId &&
      m.recordType === recordTypeLower &&
      m.orgId === orgId &&
      (m.status === "active" || m.status === "completed"),
  );
  if (!membership) return 0;

  // Fetch all activities for this recipient, filter by email type, and sort by ID
  const allActs = (await dbStore.activities.findMany()) as {
    id: string;
    type: string;
    orgId: string;
  }[];
  const recipientActivityIds = new Set(
    links
      .filter(
        (l) =>
          l.targetId === actLink.targetId &&
          l.targetType.toLowerCase() === recordTypeLower &&
          l.orgId === orgId,
      )
      .map((l) => l.activityId),
  );

  const emailActs = allActs.filter(
    (act) =>
      act.type === "email" &&
      act.orgId === orgId &&
      recipientActivityIds.has(act.id),
  );
  emailActs.sort((a, b) => a.id.localeCompare(b.id));

  // Determine which step this is
  const clickedIdx = emailActs.findIndex((act) => act.id === activityId);
  if (clickedIdx === -1) return 0;
  const stepNumber = clickedIdx + 1;

  const steps = (await dbStore.marketingSequenceSteps.findForSequence(
    membership.sequenceId,
  )) as { id: string; stepNumber: number; orgId: string }[];
  const step = steps.find(
    (s) => s.stepNumber === stepNumber && s.orgId === orgId,
  );
  if (!step) return 0;

  const actions = (await dbStore.marketingSequenceOpenActions.findForStep(
    step.id,
  )) as {
    orgId: string;
    actionType: string;
    actionConfig: {
      field?: string;
      value?: string;
      subject?: string;
      body?: string | null;
      dueDateOffsetDays?: number;
    };
  }[];
  const matchingActions = actions.filter((act) => act.orgId === orgId);

  let executedCount = 0;
  for (const act of matchingActions) {
    if (act.actionType === "field_update") {
      const field = act.actionConfig?.field;
      const value = act.actionConfig?.value;
      if (field && value !== undefined) {
        if (recordTypeLower === "lead" && dbStore.leads) {
          const lead = await dbStore.leads.findOne(actLink.targetId);
          if (lead) {
            // biome-ignore lint/suspicious/noExplicitAny: casting safe
            const leadAny = lead as any;
            const beforeVal = field.startsWith("custom.")
              ? (leadAny.custom as Record<string, unknown>)?.[
                  field.substring(7)
                ]
              : leadAny[field];

            if (field.startsWith("custom.")) {
              const customField = field.substring(7);
              const newCustom = {
                ...(leadAny.custom || {}),
                [customField]: value,
              };
              await dbStore.leads.update(actLink.targetId, {
                custom: newCustom,
              });
            } else {
              await dbStore.leads.update(actLink.targetId, { [field]: value });
            }

            await dbStore.auditLogs.insert({
              orgId,
              recordId: actLink.targetId,
              recordType: "lead",
              action: "open_trigger_field_update",
              userId: "00000000-0000-0000-0000-000000000000",
              changes: {
                [field]: { before: beforeVal, after: value },
              },
            });
            executedCount++;
          }
        } else if (recordTypeLower === "contact" && dbStore.contacts) {
          const contact = await dbStore.contacts.findOne(actLink.targetId);
          if (contact) {
            // biome-ignore lint/suspicious/noExplicitAny: casting safe
            const contactAny = contact as any;
            const beforeVal = field.startsWith("custom.")
              ? (contactAny.custom as Record<string, unknown>)?.[
                  field.substring(7)
                ]
              : contactAny[field];

            if (field.startsWith("custom.")) {
              const customField = field.substring(7);
              const newCustom = {
                ...(contactAny.custom || {}),
                [customField]: value,
              };
              await dbStore.contacts.update(actLink.targetId, {
                custom: newCustom,
              });
            } else {
              await dbStore.contacts.update(actLink.targetId, {
                [field]: value,
              });
            }

            await dbStore.auditLogs.insert({
              orgId,
              recordId: actLink.targetId,
              recordType: "contact",
              action: "open_trigger_field_update",
              userId: "00000000-0000-0000-0000-000000000000",
              changes: {
                [field]: { before: beforeVal, after: value },
              },
            });
            executedCount++;
          }
        }
      }
    } else if (act.actionType === "create_task") {
      const subject = act.actionConfig?.subject || "Follow up";
      const body = act.actionConfig?.body || null;
      const offsetDays = act.actionConfig?.dueDateOffsetDays || 0;
      const dueDate = new Date(
        currentTime.getTime() + offsetDays * 24 * 60 * 60 * 1000,
      );

      const task = await dbStore.activities.insert({
        orgId,
        creatorId: "00000000-0000-0000-0000-000000000000",
        type: "task",
        subject,
        body,
        dueDate,
        createdAt: currentTime,
      });

      await dbStore.activityLinks.insert({
        orgId,
        activityId: task.id,
        targetType: actLink.targetType,
        targetId: actLink.targetId,
      });

      await dbStore.auditLogs.insert({
        orgId,
        recordId: membership.id,
        recordType: "marketing_sequence_memberships",
        action: "open_trigger_create_task",
        userId: "00000000-0000-0000-0000-000000000000",
        changes: {
          taskId: { before: null, after: task.id },
          subject: { before: null, after: subject },
        },
      });
      executedCount++;
    }
  }

  if (executedCount > 0) {
    await dbStore.auditLogs.insert({
      orgId,
      recordId: membership.id,
      recordType: "marketing_sequence_memberships",
      action: "open_trigger_executed",
      userId: "00000000-0000-0000-0000-000000000000",
      changes: {
        executedActionsCount: { before: 0, after: executedCount },
      },
    });
  }

  return executedCount;
}

export async function processSequenceEmailReply(
  // biome-ignore lint/suspicious/noExplicitAny: dynamic store
  dbStore: any,
  orgId: string,
  activityId: string,
  currentTime: Date = new Date(),
): Promise<number> {
  const links = (await dbStore.activityLinks.findMany()) as {
    activityId: string;
    orgId: string;
    targetType: "Lead" | "Contact" | "Opportunity" | "Account" | "Campaign";
    targetId: string;
  }[];
  const actLink = links.find(
    (l) =>
      l.activityId === activityId &&
      l.orgId === orgId &&
      (l.targetType.toLowerCase() === "lead" ||
        l.targetType.toLowerCase() === "contact"),
  );
  if (!actLink) return 0;

  const memberships =
    (await dbStore.marketingSequenceMemberships.findMany()) as {
      id: string;
      recordId: string;
      recordType: string;
      orgId: string;
      status: string;
      sequenceId: string;
    }[];
  const recordTypeLower = actLink.targetType.toLowerCase();
  const membership = memberships.find(
    (m) =>
      m.recordId === actLink.targetId &&
      m.recordType === recordTypeLower &&
      m.orgId === orgId &&
      (m.status === "active" || m.status === "completed"),
  );
  if (!membership) return 0;

  // Auto-complete the membership when they reply!
  const oldStatus = membership.status;
  if (oldStatus !== "completed") {
    await dbStore.marketingSequenceMemberships.update(membership.id, {
      status: "completed",
    });

    await dbStore.auditLogs.insert({
      orgId,
      recordId: membership.id,
      recordType: "marketing_sequence_memberships",
      action: "membership_auto_completed_on_reply",
      userId: "00000000-0000-0000-0000-000000000000",
      changes: {
        status: { before: oldStatus, after: "completed" },
      },
    });
  }

  // Fetch all activities for this recipient, filter by email type, and sort by ID
  const allActs = (await dbStore.activities.findMany()) as {
    id: string;
    type: string;
    orgId: string;
  }[];
  const recipientActivityIds = new Set(
    links
      .filter(
        (l) =>
          l.targetId === actLink.targetId &&
          l.targetType.toLowerCase() === recordTypeLower &&
          l.orgId === orgId,
      )
      .map((l) => l.activityId),
  );

  const emailActs = allActs.filter(
    (act) =>
      act.type === "email" &&
      act.orgId === orgId &&
      recipientActivityIds.has(act.id),
  );
  emailActs.sort((a, b) => a.id.localeCompare(b.id));

  // Determine which step this is
  const clickedIdx = emailActs.findIndex((act) => act.id === activityId);
  if (clickedIdx === -1) return 0;
  const stepNumber = clickedIdx + 1;

  const steps = (await dbStore.marketingSequenceSteps.findForSequence(
    membership.sequenceId,
  )) as { id: string; stepNumber: number; orgId: string }[];
  const step = steps.find(
    (s) => s.stepNumber === stepNumber && s.orgId === orgId,
  );
  if (!step) return 0;

  const actions = (await dbStore.marketingSequenceReplyActions.findForStep(
    step.id,
  )) as {
    orgId: string;
    actionType: string;
    actionConfig: {
      field?: string;
      value?: string;
      subject?: string;
      body?: string | null;
      dueDateOffsetDays?: number;
    };
  }[];
  const matchingActions = actions.filter((act) => act.orgId === orgId);

  let executedCount = 0;
  for (const act of matchingActions) {
    if (act.actionType === "field_update") {
      const field = act.actionConfig?.field;
      const value = act.actionConfig?.value;
      if (field && value !== undefined) {
        if (recordTypeLower === "lead" && dbStore.leads) {
          const lead = await dbStore.leads.findOne(actLink.targetId);
          if (lead) {
            // biome-ignore lint/suspicious/noExplicitAny: casting safe
            const leadAny = lead as any;
            const beforeVal = field.startsWith("custom.")
              ? (leadAny.custom as Record<string, unknown>)?.[
                  field.substring(7)
                ]
              : leadAny[field];

            if (field.startsWith("custom.")) {
              const customField = field.substring(7);
              const newCustom = {
                ...(leadAny.custom || {}),
                [customField]: value,
              };
              await dbStore.leads.update(actLink.targetId, {
                custom: newCustom,
              });
            } else {
              await dbStore.leads.update(actLink.targetId, { [field]: value });
            }

            await dbStore.auditLogs.insert({
              orgId,
              recordId: actLink.targetId,
              recordType: "lead",
              action: "reply_trigger_field_update",
              userId: "00000000-0000-0000-0000-000000000000",
              changes: {
                [field]: { before: beforeVal, after: value },
              },
            });
            executedCount++;
          }
        } else if (recordTypeLower === "contact" && dbStore.contacts) {
          const contact = await dbStore.contacts.findOne(actLink.targetId);
          if (contact) {
            // biome-ignore lint/suspicious/noExplicitAny: casting safe
            const contactAny = contact as any;
            const beforeVal = field.startsWith("custom.")
              ? (contactAny.custom as Record<string, unknown>)?.[
                  field.substring(7)
                ]
              : contactAny[field];

            if (field.startsWith("custom.")) {
              const customField = field.substring(7);
              const newCustom = {
                ...(contactAny.custom || {}),
                [customField]: value,
              };
              await dbStore.contacts.update(actLink.targetId, {
                custom: newCustom,
              });
            } else {
              await dbStore.contacts.update(actLink.targetId, {
                [field]: value,
              });
            }

            await dbStore.auditLogs.insert({
              orgId,
              recordId: actLink.targetId,
              recordType: "contact",
              action: "reply_trigger_field_update",
              userId: "00000000-0000-0000-0000-000000000000",
              changes: {
                [field]: { before: beforeVal, after: value },
              },
            });
            executedCount++;
          }
        }
      }
    } else if (act.actionType === "create_task") {
      const subject = act.actionConfig?.subject || "Follow up on Reply";
      const body = act.actionConfig?.body || null;
      const offsetDays = act.actionConfig?.dueDateOffsetDays || 0;
      const dueDate = new Date(
        currentTime.getTime() + offsetDays * 24 * 60 * 60 * 1000,
      );

      const task = await dbStore.activities.insert({
        orgId,
        creatorId: "00000000-0000-0000-0000-000000000000",
        type: "task",
        subject,
        body,
        dueDate,
        createdAt: currentTime,
      });

      await dbStore.activityLinks.insert({
        orgId,
        activityId: task.id,
        targetType: actLink.targetType,
        targetId: actLink.targetId,
      });

      await dbStore.auditLogs.insert({
        orgId,
        recordId: membership.id,
        recordType: "marketing_sequence_memberships",
        action: "reply_trigger_create_task",
        userId: "00000000-0000-0000-0000-000000000000",
        changes: {
          taskId: { before: null, after: task.id },
          subject: { before: null, after: subject },
        },
      });
      executedCount++;
    }
  }

  if (executedCount > 0) {
    await dbStore.auditLogs.insert({
      orgId,
      recordId: membership.id,
      recordType: "marketing_sequence_memberships",
      action: "reply_trigger_executed",
      userId: "00000000-0000-0000-0000-000000000000",
      changes: {
        executedActionsCount: { before: 0, after: executedCount },
      },
    });
  }

  return executedCount;
}

export function calculateUnsubscribeAnalytics(
  params: UnsubscribeAnalyticsInput,
): UnsubscribeAnalyticsResult {
  const { unsubscribes, trackers, links, memberships, sequences } = params;

  const trackerMap = new Map(trackers.map((t) => [t.id, t.activityId]));
  const linkMap = new Map(links.map((l) => [l.activityId, l.targetId]));
  const sequenceMap = new Map(sequences.map((s) => [s.id, s.name]));

  const reasonCounts: Record<string, number> = {
    frequency: 0,
    relevance: 0,
    not_requested: 0,
    other: 0,
  };

  const sequenceCounts = new Map<string, number>();

  for (const unsub of unsubscribes) {
    if (unsub.reason in reasonCounts) {
      reasonCounts[unsub.reason]++;
    } else {
      reasonCounts.other++;
    }

    const activityId = trackerMap.get(unsub.trackerId);
    if (activityId) {
      const targetId = linkMap.get(activityId);
      if (targetId) {
        const matchingMemberships = memberships.filter(
          (m) => m.recordId === targetId,
        );
        let selectedSeqId = "";
        const unsubMembership = matchingMemberships.find(
          (m) => m.status === "unsubscribed",
        );
        if (unsubMembership) {
          selectedSeqId = unsubMembership.sequenceId;
        } else if (matchingMemberships.length > 0) {
          selectedSeqId = matchingMemberships[0].sequenceId;
        }

        if (selectedSeqId) {
          sequenceCounts.set(
            selectedSeqId,
            (sequenceCounts.get(selectedSeqId) || 0) + 1,
          );
        }
      }
    }
  }

  const total = unsubscribes.length;
  const reasonBreakdown = Object.entries(reasonCounts).map(
    ([reason, count]) => ({
      reason,
      count,
      percentage: total > 0 ? `${((count / total) * 100).toFixed(1)}%` : "0.0%",
    }),
  );

  const sequenceBreakdown = Array.from(sequenceCounts.entries()).map(
    ([seqId, count]) => ({
      sequenceId: seqId,
      sequenceName: sequenceMap.get(seqId) || "Unknown Sequence",
      count,
      percentage: total > 0 ? `${((count / total) * 100).toFixed(1)}%` : "0.0%",
    }),
  );

  return {
    totalUnsubscribes: total,
    reasonBreakdown,
    sequenceBreakdown,
  };
}

export function calculateOpenAnalytics(
  params: OpenAnalyticsInput,
): OpenAnalyticsResult {
  const {
    opens,
    trackers,
    activities,
    activityLinks,
    memberships,
    steps,
    sequenceId,
  } = params;

  const seqMemberships = memberships.filter((m) => m.sequenceId === sequenceId);
  const seqSteps = steps.filter((s) => s.sequenceId === sequenceId);

  // 1. Map trackerId -> activityId
  const trackerToActivity = new Map<string, string>();
  for (const t of trackers) {
    trackerToActivity.set(t.id, t.activityId);
  }

  // 2. Build activityToStep mapping
  const activityToStep = new Map<string, { id: string; name: string }>();
  for (const m of seqMemberships) {
    const linksForRecord = activityLinks.filter(
      (link) =>
        link.targetId === m.recordId &&
        (link.targetType === "Lead" || link.targetType === "Contact"),
    );
    const activityIds = linksForRecord.map((l) => l.activityId);
    const emailActs = activities.filter(
      (act) => act.type === "email" && activityIds.includes(act.id),
    );
    emailActs.sort((a, b) => a.id.localeCompare(b.id));

    emailActs.forEach((act, idx) => {
      const stepNum = idx + 1;
      const step = seqSteps.find((s) => s.stepNumber === stepNum);
      if (step) {
        activityToStep.set(act.id, {
          id: step.id,
          name: step.name || `Step ${step.stepNumber}`,
        });
      }
    });
  }

  // 3. Count total sent (activities) per step
  const stepSentCount = new Map<string, number>();
  for (const step of seqSteps) {
    stepSentCount.set(step.id, 0);
  }
  for (const [_actId, stepInfo] of activityToStep.entries()) {
    stepSentCount.set(stepInfo.id, (stepSentCount.get(stepInfo.id) || 0) + 1);
  }

  // 4. Group open events by trackerId to calculate unique opens
  const uniqueTrackerOpens = new Set<string>();
  const stepUniqueOpens = new Map<string, Set<string>>();
  for (const step of seqSteps) {
    stepUniqueOpens.set(step.id, new Set<string>());
  }

  const deviceCounts = new Map<string, number>();
  let totalTrackedOpens = 0;

  for (const op of opens) {
    const activityId = trackerToActivity.get(op.trackerId);
    if (activityId) {
      const stepInfo = activityToStep.get(activityId);
      if (stepInfo) {
        // Unique opens globally
        uniqueTrackerOpens.add(op.trackerId);

        // Unique opens per step
        const stepUnique = stepUniqueOpens.get(stepInfo.id);
        if (stepUnique) {
          stepUnique.add(op.trackerId);
        }

        // Device type counts
        const devType = op.deviceType || "desktop";
        deviceCounts.set(devType, (deviceCounts.get(devType) || 0) + 1);

        totalTrackedOpens++;
      }
    }
  }

  const totalUniqueOpens = uniqueTrackerOpens.size;

  // Calculate device performance breakdown
  const devicePerformance: DevicePerformanceMetric[] = Array.from(
    deviceCounts.entries(),
  ).map(([deviceType, count]) => ({
    deviceType,
    openCount: count,
    percentage:
      totalTrackedOpens > 0
        ? `${((count / totalTrackedOpens) * 100).toFixed(1)}%`
        : "0.0%",
  }));
  devicePerformance.sort((a, b) => b.openCount - a.openCount);

  // Calculate step open rates
  const stepOpenRates: StepOpenRateMetric[] = seqSteps.map((step) => {
    const totalSent = stepSentCount.get(step.id) || 0;
    const uniqueOpens = stepUniqueOpens.get(step.id)?.size || 0;
    return {
      stepId: step.id,
      stepName: step.name || `Step ${step.stepNumber}`,
      totalSent,
      uniqueOpens,
      openRate:
        totalSent > 0
          ? `${((uniqueOpens / totalSent) * 100).toFixed(1)}%`
          : "0.0%",
    };
  });

  return {
    totalUniqueOpens,
    totalTrackedOpens,
    devicePerformance,
    stepOpenRates,
  };
}

export function calculateReplyAnalytics(
  params: ReplyAnalyticsInput,
): ReplyAnalyticsResult {
  const {
    replies,
    trackers,
    activities,
    activityLinks,
    memberships,
    steps,
    sequenceId,
  } = params;

  const seqMemberships = memberships.filter((m) => m.sequenceId === sequenceId);
  const seqSteps = steps.filter((s) => s.sequenceId === sequenceId);

  // 1. Map trackerId -> activityId
  const trackerToActivity = new Map<string, string>();
  for (const t of trackers) {
    trackerToActivity.set(t.id, t.activityId);
  }

  // 2. Build activityToStep mapping
  const activityToStep = new Map<string, { id: string; name: string }>();
  for (const m of seqMemberships) {
    const linksForRecord = activityLinks.filter(
      (link) =>
        link.targetId === m.recordId &&
        (link.targetType.toLowerCase() === "lead" ||
          link.targetType.toLowerCase() === "contact"),
    );
    const activityIds = linksForRecord.map((l) => l.activityId);
    const emailActs = activities.filter(
      (act) => act.type === "email" && activityIds.includes(act.id),
    );
    emailActs.sort((a, b) => a.id.localeCompare(b.id));

    emailActs.forEach((act, idx) => {
      const stepNum = idx + 1;
      const step = seqSteps.find((s) => s.stepNumber === stepNum);
      if (step) {
        activityToStep.set(act.id, {
          id: step.id,
          name: step.name || `Step ${step.stepNumber}`,
        });
      }
    });
  }

  // 3. Count total sent (activities) per step
  const stepSentCount = new Map<string, number>();
  for (const step of seqSteps) {
    stepSentCount.set(step.id, 0);
  }
  for (const [_actId, stepInfo] of activityToStep.entries()) {
    stepSentCount.set(stepInfo.id, (stepSentCount.get(stepInfo.id) || 0) + 1);
  }

  // 4. Group reply events by trackerId to calculate unique replies
  const uniqueTrackerReplies = new Set<string>();
  const stepUniqueReplies = new Map<string, Set<string>>();
  for (const step of seqSteps) {
    stepUniqueReplies.set(step.id, new Set<string>());
  }

  const sentimentCounts = new Map<string, number>();
  let totalTrackedReplies = 0;

  for (const rep of replies) {
    const activityId = trackerToActivity.get(rep.trackerId);
    if (activityId) {
      const stepInfo = activityToStep.get(activityId);
      if (stepInfo) {
        // Unique replies globally
        uniqueTrackerReplies.add(rep.trackerId);

        // Unique replies per step
        const stepUnique = stepUniqueReplies.get(stepInfo.id);
        if (stepUnique) {
          stepUnique.add(rep.trackerId);
        }

        // Sentiment type counts
        const sentiment = rep.sentiment || "neutral";
        sentimentCounts.set(
          sentiment,
          (sentimentCounts.get(sentiment) || 0) + 1,
        );

        totalTrackedReplies++;
      }
    }
  }

  const totalUniqueReplies = uniqueTrackerReplies.size;
  const totalSentGlobally = Array.from(stepSentCount.values()).reduce(
    (a, b) => a + b,
    0,
  );

  // Calculate sentiment performance breakdown
  const sentimentPerformance: SentimentPerformanceMetric[] = Array.from(
    sentimentCounts.entries(),
  ).map(([sentiment, count]) => ({
    sentiment,
    replyCount: count,
    percentage:
      totalTrackedReplies > 0
        ? `${((count / totalTrackedReplies) * 100).toFixed(1)}%`
        : "0.0%",
  }));
  // Ensure all standard sentiments have entries even if 0
  const sentiments = ["positive", "neutral", "negative"];
  for (const s of sentiments) {
    if (!sentimentPerformance.some((x) => x.sentiment === s)) {
      sentimentPerformance.push({
        sentiment: s,
        replyCount: 0,
        percentage: "0.0%",
      });
    }
  }
  sentimentPerformance.sort((a, b) => b.replyCount - a.replyCount);

  // Calculate step reply rates
  const stepReplyRates: StepReplyRateMetric[] = seqSteps.map((step) => {
    const totalSent = stepSentCount.get(step.id) || 0;
    const uniqueReplies = stepUniqueReplies.get(step.id)?.size || 0;
    return {
      stepId: step.id,
      stepName: step.name || `Step ${step.stepNumber}`,
      totalSent,
      uniqueReplies,
      replyRate:
        totalSent > 0
          ? `${((uniqueReplies / totalSent) * 100).toFixed(1)}%`
          : "0.0%",
    };
  });

  return {
    totalUniqueReplies,
    totalTrackedReplies,
    replyRate:
      totalSentGlobally > 0
        ? `${((totalUniqueReplies / totalSentGlobally) * 100).toFixed(1)}%`
        : "0.0%",
    sentimentPerformance,
    stepReplyRates,
  };
}

export function calculateBounceAnalytics(
  params: BounceAnalyticsInput,
): BounceAnalyticsResult {
  const {
    bounces,
    trackers,
    activities,
    activityLinks,
    memberships,
    steps,
    sequenceId,
  } = params;

  const seqMemberships = memberships.filter((m) => m.sequenceId === sequenceId);
  const seqSteps = steps.filter((s) => s.sequenceId === sequenceId);

  // 1. Map trackerId -> activityId
  const trackerToActivity = new Map<string, string>();
  for (const t of trackers) {
    trackerToActivity.set(t.id, t.activityId);
  }

  // 2. Build activityToStep mapping
  const activityToStep = new Map<string, { id: string; name: string }>();
  for (const m of seqMemberships) {
    const linksForRecord = activityLinks.filter(
      (link) =>
        link.targetId === m.recordId &&
        (link.targetType.toLowerCase() === "lead" ||
          link.targetType.toLowerCase() === "contact"),
    );
    const activityIds = linksForRecord.map((l) => l.activityId);
    const emailActs = activities.filter(
      (act) => act.type === "email" && activityIds.includes(act.id),
    );
    emailActs.sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );

    emailActs.forEach((act, idx) => {
      const stepNum = idx + 1;
      const step = seqSteps.find((s) => s.stepNumber === stepNum);
      if (step) {
        activityToStep.set(act.id, {
          id: step.id,
          name: step.name || `Step ${step.stepNumber}`,
        });
      }
    });
  }

  // 3. Count total sent (activities) per step
  const stepSentCount = new Map<string, number>();
  for (const step of seqSteps) {
    stepSentCount.set(step.id, 0);
  }
  for (const [_actId, stepInfo] of activityToStep.entries()) {
    stepSentCount.set(stepInfo.id, (stepSentCount.get(stepInfo.id) || 0) + 1);
  }

  // 4. Group bounce events by trackerId to calculate unique bounces
  const uniqueTrackerBounces = new Set<string>();
  const stepUniqueBounces = new Map<string, Set<string>>();
  for (const step of seqSteps) {
    stepUniqueBounces.set(step.id, new Set<string>());
  }

  const bounceTypeCounts = new Map<string, number>();
  let totalBounces = 0;
  let totalComplaints = 0;
  let totalTrackedEvents = 0;

  for (const b of bounces) {
    const activityId = trackerToActivity.get(b.trackerId);
    if (activityId) {
      const stepInfo = activityToStep.get(activityId);
      if (stepInfo) {
        // Unique bounces globally
        uniqueTrackerBounces.add(b.trackerId);

        // Unique bounces per step
        const stepUnique = stepUniqueBounces.get(stepInfo.id);
        if (stepUnique) {
          stepUnique.add(b.trackerId);
        }

        // Event type counts
        if (b.eventType === "complaint") {
          totalComplaints++;
        } else {
          totalBounces++;
        }

        // Bounce type counts
        const bounceType = b.bounceType || "hard";
        bounceTypeCounts.set(
          bounceType,
          (bounceTypeCounts.get(bounceType) || 0) + 1,
        );

        totalTrackedEvents++;
      }
    }
  }

  const totalUniqueBouncedTrackers = uniqueTrackerBounces.size;
  const totalSentGlobally = Array.from(stepSentCount.values()).reduce(
    (a, b) => a + b,
    0,
  );

  // Calculate bounce type performance breakdown
  const bounceTypePerformance: BounceTypePerformanceMetric[] = Array.from(
    bounceTypeCounts.entries(),
  ).map(([bType, count]) => ({
    bounceType: bType,
    eventCount: count,
    percentage:
      totalTrackedEvents > 0
        ? `${((count / totalTrackedEvents) * 100).toFixed(1)}%`
        : "0.0%",
  }));

  // Ensure all standard bounce types have entries even if 0
  const bounceTypes = ["hard", "soft", "spam_complaint"];
  for (const bt of bounceTypes) {
    if (!bounceTypePerformance.some((x) => x.bounceType === bt)) {
      bounceTypePerformance.push({
        bounceType: bt,
        eventCount: 0,
        percentage: "0.0%",
      });
    }
  }
  bounceTypePerformance.sort((a, b) => b.eventCount - a.eventCount);

  // Calculate step bounce rates
  const stepBounceRates: StepBounceRateMetric[] = seqSteps.map((step) => {
    const totalSent = stepSentCount.get(step.id) || 0;
    const uniqueBounces = stepUniqueBounces.get(step.id)?.size || 0;
    return {
      stepId: step.id,
      stepName: step.name || `Step ${step.stepNumber}`,
      totalSent,
      uniqueBounces,
      bounceRate:
        totalSent > 0
          ? `${((uniqueBounces / totalSent) * 100).toFixed(1)}%`
          : "0.0%",
    };
  });

  return {
    totalBounces,
    totalComplaints,
    totalUniqueBouncedTrackers,
    bounceRate:
      totalSentGlobally > 0
        ? `${((totalUniqueBouncedTrackers / totalSentGlobally) * 100).toFixed(1)}%`
        : "0.0%",
    bounceTypePerformance,
    stepBounceRates,
  };
}

export function calculateReadTimeAnalytics(
  params: ReadTimeAnalyticsInput,
): ReadTimeAnalyticsResult {
  const {
    readTimeEvents,
    trackers,
    activities,
    activityLinks,
    memberships,
    steps,
    sequenceId,
  } = params;

  const seqMemberships = memberships.filter((m) => m.sequenceId === sequenceId);
  const seqSteps = steps.filter((s) => s.sequenceId === sequenceId);

  // 1. Map trackerId -> activityId and trackerId -> trackerObj
  const trackerToActivity = new Map<string, string>();
  for (const t of trackers) {
    trackerToActivity.set(t.id, t.activityId);
  }

  // 2. Build activityToStep mapping
  const activityToStep = new Map<string, { id: string; name: string }>();
  for (const m of seqMemberships) {
    const linksForRecord = activityLinks.filter(
      (link) =>
        link.targetId === m.recordId &&
        (link.targetType.toLowerCase() === "lead" ||
          link.targetType.toLowerCase() === "contact"),
    );
    const activityIds = linksForRecord.map((l) => l.activityId);
    const emailActs = activities.filter(
      (act) => act.type === "email" && activityIds.includes(act.id),
    );
    emailActs.sort(
      (a, b) =>
        new Date(a.createdAt || "").getTime() -
        new Date(b.createdAt || "").getTime(),
    );

    emailActs.forEach((act, idx) => {
      const stepNum = idx + 1;
      const step = seqSteps.find((s) => s.stepNumber === stepNum);
      if (step) {
        activityToStep.set(act.id, {
          id: step.id,
          name: step.name || `Step ${step.stepNumber}`,
        });
      }
    });
  }

  // 3. Count total openCount per step and total glanced, skimmed, read
  const stepOpenCount = new Map<string, number>();
  const stepGlancedCount = new Map<string, number>();
  const stepSkimmedCount = new Map<string, number>();
  const stepReadCount = new Map<string, number>();

  for (const step of seqSteps) {
    stepOpenCount.set(step.id, 0);
    stepGlancedCount.set(step.id, 0);
    stepSkimmedCount.set(step.id, 0);
    stepReadCount.set(step.id, 0);
  }

  // Trackers' openCount can be accumulated by step
  for (const t of trackers) {
    const activityId = t.activityId;
    if (activityId) {
      const stepInfo = activityToStep.get(activityId);
      if (stepInfo) {
        stepOpenCount.set(
          stepInfo.id,
          (stepOpenCount.get(stepInfo.id) || 0) + t.openCount,
        );
      }
    }
  }

  let totalGlanced = 0;
  let totalSkimmed = 0;
  let totalRead = 0;
  let totalDurationMs = 0;
  let totalEventsCount = 0;

  for (const event of readTimeEvents) {
    const activityId = trackerToActivity.get(event.trackerId);
    if (activityId) {
      const stepInfo = activityToStep.get(activityId);
      if (stepInfo) {
        totalEventsCount++;
        totalDurationMs += event.durationMs;

        const classification = event.readClassification;
        if (classification === "glanced") {
          totalGlanced++;
          stepGlancedCount.set(
            stepInfo.id,
            (stepGlancedCount.get(stepInfo.id) || 0) + 1,
          );
        } else if (classification === "skimmed") {
          totalSkimmed++;
          stepSkimmedCount.set(
            stepInfo.id,
            (stepSkimmedCount.get(stepInfo.id) || 0) + 1,
          );
        } else if (classification === "read") {
          totalRead++;
          stepReadCount.set(
            stepInfo.id,
            (stepReadCount.get(stepInfo.id) || 0) + 1,
          );
        }
      }
    }
  }

  const averageReadTimeMs =
    totalEventsCount > 0 ? Math.round(totalDurationMs / totalEventsCount) : 0;

  // Build performance breakdown
  const readTimeClassificationPerformance: ReadTimePerformanceMetric[] = [
    {
      classification: "glanced",
      eventCount: totalGlanced,
      percentage:
        totalEventsCount > 0
          ? `${((totalGlanced / totalEventsCount) * 100).toFixed(1)}%`
          : "0.0%",
    },
    {
      classification: "skimmed",
      eventCount: totalSkimmed,
      percentage:
        totalEventsCount > 0
          ? `${((totalSkimmed / totalEventsCount) * 100).toFixed(1)}%`
          : "0.0%",
    },
    {
      classification: "read",
      eventCount: totalRead,
      percentage:
        totalEventsCount > 0
          ? `${((totalRead / totalEventsCount) * 100).toFixed(1)}%`
          : "0.0%",
    },
  ];

  // Calculate step read time stats
  const stepReadTimeStats: StepReadTimeStatsMetric[] = seqSteps.map((step) => {
    return {
      stepId: step.id,
      stepName: step.name || `Step ${step.stepNumber}`,
      openCount: stepOpenCount.get(step.id) || 0,
      glancedCount: stepGlancedCount.get(step.id) || 0,
      skimmedCount: stepSkimmedCount.get(step.id) || 0,
      readCount: stepReadCount.get(step.id) || 0,
    };
  });

  return {
    totalGlanced,
    totalSkimmed,
    totalRead,
    averageReadTimeMs,
    readTimeClassificationPerformance,
    stepReadTimeStats,
  };
}

export async function processSequenceMembershipScoreTriggers(
  // biome-ignore lint/suspicious/noExplicitAny: dbStore dynamic reference
  db: any,
  orgId: string,
  membershipId: string,
): Promise<{ triggeredCount: number; executedActions: string[] }> {
  const membership =
    await db.marketingSequenceMemberships.findOne(membershipId);
  if (membership?.status !== "active") {
    return { triggeredCount: 0, executedActions: [] };
  }

  const triggers = await db.marketingSequenceScoreTriggers.findForSequence(
    membership.sequenceId,
  );
  const currentScore = membership.engagementScore ?? 0;

  const executedActions: string[] = [];
  let triggeredCount = 0;

  for (const trigger of triggers) {
    if (currentScore >= trigger.scoreThreshold) {
      triggeredCount++;
      const actionType = trigger.actionType;

      if (actionType === "change_lead_status") {
        if (membership.recordType === "lead") {
          const lead = await db.leads.findOne(membership.recordId);
          const targetStatus = trigger.actionConfig.status || "Qualified";
          if (lead && lead.status !== targetStatus) {
            await db.leads.update(membership.recordId, {
              status: targetStatus,
            });
            executedActions.push(`change_lead_status:${targetStatus}`);
          }
        }
      } else if (actionType === "auto_exit") {
        if (membership.status === "active") {
          await db.marketingSequenceMemberships.update(membershipId, {
            status: "completed",
          });
          executedActions.push("auto_exit");
        }
      } else if (actionType === "notify_owner") {
        let ownerId = "system";
        let targetType: "Lead" | "Contact" = "Lead";
        if (membership.recordType === "lead") {
          const lead = await db.leads.findOne(membership.recordId);
          if (lead) ownerId = lead.ownerId;
          targetType = "Lead";
        } else {
          const contact = await db.contacts.findOne(membership.recordId);
          if (contact) ownerId = contact.ownerId;
          targetType = "Contact";
        }

        const subject =
          trigger.actionConfig.subject || "[High Engagement] Follow up needed";
        const body =
          trigger.actionConfig.body ||
          `Recipient has reached score ${currentScore}.`;

        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + 1);

        const task = await db.activities.insert({
          orgId,
          creatorId: "system",
          type: "task",
          subject,
          body,
          dueDate,
        });

        await db.activityLinks.insert({
          orgId,
          activityId: task.id,
          targetType,
          targetId: membership.recordId,
        });

        executedActions.push(`notify_owner:${ownerId}`);
      }
    }
  }

  return { triggeredCount, executedActions };
}

export async function cloneMarketingSequence(
  // biome-ignore lint/suspicious/noExplicitAny: dbStore dynamic reference
  dbStore: any,
  sequenceId: string,
  newName: string,
  orgId: string,
  // biome-ignore lint/suspicious/noExplicitAny: returned cloned object
): Promise<any> {
  const sequence = await dbStore.marketingSequences.findOne(sequenceId);
  if (!sequence) {
    throw new Error("Sequence not found");
  }
  if (sequence.orgId !== orgId) {
    throw new Error("RLS Isolation Violation: Tenant mismatch.");
  }

  const clonedSequence = await dbStore.marketingSequences.insert({
    orgId,
    name: newName,
    description: sequence.description,
    status: "draft",
    sendingWindowStart: sequence.sendingWindowStart || null,
    sendingWindowEnd: sequence.sendingWindowEnd || null,
    sendingDays: sequence.sendingDays || null,
    allowReenrollment: sequence.allowReenrollment || false,
    reenrollmentMinDays: sequence.reenrollmentMinDays || null,
    dailySendLimit: sequence.dailySendLimit || null,
    senderType: sequence.senderType || "system",
    senderUserId: sequence.senderUserId || null,
    folderId: sequence.folderId || null,
  });

  const steps =
    await dbStore.marketingSequenceSteps.findForSequence(sequenceId);
  steps.sort(
    (a: { stepNumber: number }, b: { stepNumber: number }) =>
      a.stepNumber - b.stepNumber,
  );

  for (const step of steps) {
    const clonedStep = await dbStore.marketingSequenceSteps.insert({
      orgId,
      sequenceId: clonedSequence.id,
      stepNumber: step.stepNumber,
      delayDays: step.delayDays,
      templateId: step.templateId,
      waitCondition: step.waitCondition || null,
      replyToStepNumber: step.replyToStepNumber || null,
    });

    if (dbStore.marketingSequenceStepBranches) {
      const branch = await dbStore.marketingSequenceStepBranches.findForStep(
        step.id,
      );
      if (branch) {
        await dbStore.marketingSequenceStepBranches.insert({
          orgId,
          stepId: clonedStep.id,
          branchType: branch.branchType,
          evaluationWindowDays: branch.evaluationWindowDays,
          trueNextStepNumber: branch.trueNextStepNumber,
          falseNextStepNumber: branch.falseNextStepNumber,
        });
      }
    }

    if (dbStore.marketingSequenceStepSplitTests) {
      const st = await dbStore.marketingSequenceStepSplitTests.findForStep(
        step.id,
      );
      if (st) {
        await dbStore.marketingSequenceStepSplitTests.insert({
          orgId,
          stepId: clonedStep.id,
          variantTemplateId: st.variantTemplateId,
          splitWeight: st.splitWeight,
          isActive: st.isActive,
          autoPromoteWinner: st.autoPromoteWinner,
          minSendsToEvaluate: st.minSendsToEvaluate,
          evaluationMetric: st.evaluationMetric,
        });
      }
    }

    if (dbStore.marketingSequenceLinkActions) {
      const linkActions =
        await dbStore.marketingSequenceLinkActions.findForStep(step.id);
      for (const la of linkActions) {
        await dbStore.marketingSequenceLinkActions.insert({
          orgId,
          stepId: clonedStep.id,
          targetUrl: la.targetUrl,
          actionType: la.actionType,
          actionConfig: la.actionConfig,
        });
      }
    }

    if (dbStore.marketingSequenceOpenActions) {
      const openActions =
        await dbStore.marketingSequenceOpenActions.findForStep(step.id);
      for (const oa of openActions) {
        await dbStore.marketingSequenceOpenActions.insert({
          orgId,
          stepId: clonedStep.id,
          actionType: oa.actionType,
          actionConfig: oa.actionConfig,
        });
      }
    }

    if (dbStore.marketingSequenceReplyActions) {
      const replyActions =
        await dbStore.marketingSequenceReplyActions.findForStep(step.id);
      for (const ra of replyActions) {
        await dbStore.marketingSequenceReplyActions.insert({
          orgId,
          stepId: clonedStep.id,
          actionType: ra.actionType,
          actionConfig: ra.actionConfig,
        });
      }
    }
  }

  if (dbStore.marketingSequenceExitTriggers) {
    const exitTriggers =
      await dbStore.marketingSequenceExitTriggers.findForSequence(sequenceId);
    for (const et of exitTriggers) {
      await dbStore.marketingSequenceExitTriggers.insert({
        orgId,
        sequenceId: clonedSequence.id,
        triggerType: et.triggerType,
        criteria: et.criteria,
        isActive: et.isActive,
      });
    }
  }

  if (dbStore.marketingSequenceTagMappings) {
    const mappings =
      await dbStore.marketingSequenceTagMappings.findForSequence(sequenceId);
    for (const m of mappings) {
      await dbStore.marketingSequenceTagMappings.insert({
        orgId,
        sequenceId: clonedSequence.id,
        tagId: m.tagId,
      });
    }
  }

  return clonedSequence;
}

export async function archiveMarketingSequence(
  // biome-ignore lint/suspicious/noExplicitAny: dbStore dynamic reference
  dbStore: any,
  sequenceId: string,
  orgId: string,
  // biome-ignore lint/suspicious/noExplicitAny: returned updated object
): Promise<any> {
  const sequence = await dbStore.marketingSequences.findOne(sequenceId);
  if (!sequence) {
    throw new Error("Sequence not found");
  }
  if (sequence.orgId !== orgId) {
    throw new Error("RLS Isolation Violation: Tenant mismatch.");
  }

  const updatedSequence = await dbStore.marketingSequences.update(sequenceId, {
    status: "archived",
  });

  if (dbStore.marketingSequenceMemberships?.findMany) {
    const memberships = await dbStore.marketingSequenceMemberships.findMany();
    const seqMemberships = memberships.filter(
      // biome-ignore lint/suspicious/noExplicitAny: membership dynamic typing
      (m: any) => m.sequenceId === sequenceId && m.orgId === orgId,
    );
    for (const m of seqMemberships) {
      if (m.status === "active" || m.status === "paused") {
        await dbStore.marketingSequenceMemberships.update(m.id, {
          status: "completed",
        });
      }
    }
  }

  return updatedSequence;
}

export async function purgeMarketingSequence(
  // biome-ignore lint/suspicious/noExplicitAny: dbStore dynamic reference
  dbStore: any,
  sequenceId: string,
  orgId: string,
): Promise<boolean> {
  const sequence = await dbStore.marketingSequences.findOne(sequenceId);
  if (!sequence) {
    throw new Error("Sequence not found");
  }
  if (sequence.orgId !== orgId) {
    throw new Error("RLS Isolation Violation: Tenant mismatch.");
  }
  if (sequence.status !== "archived") {
    throw new Error("Only archived sequences can be purged");
  }

  // 1. Delete all step-level children and the steps themselves
  if (dbStore.marketingSequenceSteps) {
    const steps =
      await dbStore.marketingSequenceSteps.findForSequence(sequenceId);
    for (const step of steps) {
      // Branches
      if (dbStore.marketingSequenceStepBranches) {
        const branch = await dbStore.marketingSequenceStepBranches.findForStep(
          step.id,
        );
        if (branch) {
          await dbStore.marketingSequenceStepBranches.delete(branch.id);
        }
      }
      // Split Tests
      if (dbStore.marketingSequenceStepSplitTests) {
        const st = await dbStore.marketingSequenceStepSplitTests.findForStep(
          step.id,
        );
        if (st) {
          await dbStore.marketingSequenceStepSplitTests.delete(st.id);
        }
      }
      // Open Actions
      if (dbStore.marketingSequenceOpenActions) {
        const openActions =
          await dbStore.marketingSequenceOpenActions.findForStep(step.id);
        for (const oa of openActions) {
          await dbStore.marketingSequenceOpenActions.delete(oa.id);
        }
      }
      // Reply Actions
      if (dbStore.marketingSequenceReplyActions) {
        const replyActions =
          await dbStore.marketingSequenceReplyActions.findForStep(step.id);
        for (const ra of replyActions) {
          await dbStore.marketingSequenceReplyActions.delete(ra.id);
        }
      }
      // Link Actions
      if (dbStore.marketingSequenceLinkActions) {
        const linkActions =
          await dbStore.marketingSequenceLinkActions.findForStep(step.id);
        for (const la of linkActions) {
          await dbStore.marketingSequenceLinkActions.delete(la.id);
        }
      }
      // Step itself
      await dbStore.marketingSequenceSteps.delete(step.id);
    }
  }

  // 2. Exit triggers
  if (dbStore.marketingSequenceExitTriggers) {
    const exitTriggers =
      await dbStore.marketingSequenceExitTriggers.findForSequence(sequenceId);
    for (const et of exitTriggers) {
      await dbStore.marketingSequenceExitTriggers.delete(et.id);
    }
  }

  // 3. Tag mappings
  if (dbStore.marketingSequenceTagMappings) {
    const mappings =
      await dbStore.marketingSequenceTagMappings.findForSequence(sequenceId);
    for (const m of mappings) {
      await dbStore.marketingSequenceTagMappings.delete(m.id);
    }
  }

  // 4. Memberships
  if (dbStore.marketingSequenceMemberships?.findMany) {
    const memberships = await dbStore.marketingSequenceMemberships.findMany();
    const seqMemberships = memberships.filter(
      // biome-ignore lint/suspicious/noExplicitAny: membership dynamic typing
      (m: any) => m.sequenceId === sequenceId && m.orgId === orgId,
    );
    for (const m of seqMemberships) {
      await dbStore.marketingSequenceMemberships.delete(m.id);
    }
  }

  // 5. Sequence itself
  await dbStore.marketingSequences.delete(sequenceId);

  return true;
}

export async function pauseMarketingSequence(
  // biome-ignore lint/suspicious/noExplicitAny: dbStore dynamic reference
  dbStore: any,
  sequenceId: string,
  orgId: string,
  // biome-ignore lint/suspicious/noExplicitAny: returned updated object
): Promise<any> {
  const sequence = await dbStore.marketingSequences.findOne(sequenceId);
  if (!sequence) {
    throw new Error("Sequence not found");
  }
  if (sequence.orgId !== orgId) {
    throw new Error("RLS Isolation Violation: Tenant mismatch.");
  }
  if (sequence.status !== "active") {
    throw new Error("Only active sequences can be paused");
  }

  const updatedSequence = await dbStore.marketingSequences.update(sequenceId, {
    status: "paused",
  });

  return updatedSequence;
}

export async function resumeMarketingSequence(
  // biome-ignore lint/suspicious/noExplicitAny: dbStore dynamic reference
  dbStore: any,
  sequenceId: string,
  orgId: string,
  // biome-ignore lint/suspicious/noExplicitAny: returned updated object
): Promise<any> {
  const sequence = await dbStore.marketingSequences.findOne(sequenceId);
  if (!sequence) {
    throw new Error("Sequence not found");
  }
  if (sequence.orgId !== orgId) {
    throw new Error("RLS Isolation Violation: Tenant mismatch.");
  }
  if (sequence.status !== "paused") {
    throw new Error("Only paused sequences can be resumed");
  }

  const updatedSequence = await dbStore.marketingSequences.update(sequenceId, {
    status: "active",
  });

  return updatedSequence;
}

export async function reorderMarketingSequenceSteps(
  // biome-ignore lint/suspicious/noExplicitAny: dbStore dynamic reference
  dbStore: any,
  sequenceId: string,
  stepId: string,
  newStepNumber: number,
  orgId: string,
  // biome-ignore lint/suspicious/noExplicitAny: returned updated steps
): Promise<any[]> {
  const sequence = await dbStore.marketingSequences.findOne(sequenceId);
  if (!sequence) {
    throw new Error("Sequence not found");
  }
  if (sequence.orgId !== orgId) {
    throw new Error("RLS Isolation Violation: Tenant mismatch.");
  }

  const steps =
    await dbStore.marketingSequenceSteps.findForSequence(sequenceId);
  const stepToMove = steps.find((s: { id: string }) => s.id === stepId);
  if (!stepToMove) {
    throw new Error("Step not found");
  }
  for (const s of steps) {
    if (s.orgId !== orgId) {
      throw new Error("RLS Isolation Violation: Tenant mismatch.");
    }
  }

  steps.sort(
    (a: { stepNumber: number }, b: { stepNumber: number }) =>
      a.stepNumber - b.stepNumber,
  );

  const N = steps.length;
  if (newStepNumber < 1 || newStepNumber > N) {
    throw new Error(`Invalid newStepNumber. Must be between 1 and ${N}`);
  }

  const oldNum = stepToMove.stepNumber;
  if (oldNum === newStepNumber) {
    return steps;
  }

  const oldNumToNewNum = new Map<number, number>();
  const idToNewNum = new Map<string, number>();

  for (const step of steps) {
    let newNum = step.stepNumber;
    if (step.id === stepId) {
      newNum = newStepNumber;
    } else if (oldNum > newStepNumber) {
      // Moving up/earlier
      if (step.stepNumber >= newStepNumber && step.stepNumber < oldNum) {
        newNum = step.stepNumber + 1;
      }
    } else if (oldNum < newStepNumber) {
      // Moving down/later
      if (step.stepNumber > oldNum && step.stepNumber <= newStepNumber) {
        newNum = step.stepNumber - 1;
      }
    }
    oldNumToNewNum.set(step.stepNumber, newNum);
    idToNewNum.set(step.id, newNum);
  }

  // Update step_number and reply_to_step_number
  for (const step of steps) {
    const updatedStepNumber = idToNewNum.get(step.id) || step.stepNumber;
    let updatedReplyTo = step.replyToStepNumber;
    if (step.replyToStepNumber) {
      updatedReplyTo =
        oldNumToNewNum.get(step.replyToStepNumber) || step.replyToStepNumber;
    }

    await dbStore.marketingSequenceSteps.update(step.id, {
      stepNumber: updatedStepNumber,
      replyToStepNumber: updatedReplyTo || null,
    });
  }

  // Update step branches if they exist
  if (dbStore.marketingSequenceStepBranches) {
    for (const step of steps) {
      const branch = await dbStore.marketingSequenceStepBranches.findForStep(
        step.id,
      );
      if (branch) {
        const updatedTrue =
          oldNumToNewNum.get(branch.trueNextStepNumber) ||
          branch.trueNextStepNumber;
        const updatedFalse =
          oldNumToNewNum.get(branch.falseNextStepNumber) ||
          branch.falseNextStepNumber;
        await dbStore.marketingSequenceStepBranches.update(branch.id, {
          trueNextStepNumber: updatedTrue,
          falseNextStepNumber: updatedFalse,
        });
      }
    }
  }

  const updatedSteps =
    await dbStore.marketingSequenceSteps.findForSequence(sequenceId);
  updatedSteps.sort(
    (a: { stepNumber: number }, b: { stepNumber: number }) =>
      a.stepNumber - b.stepNumber,
  );
  return updatedSteps;
}

export async function deleteMarketingSequenceStep(
  // biome-ignore lint/suspicious/noExplicitAny: dbStore dynamic reference
  dbStore: any,
  sequenceId: string,
  stepId: string,
  orgId: string,
  // biome-ignore lint/suspicious/noExplicitAny: returned updated steps
): Promise<any[]> {
  const sequence = await dbStore.marketingSequences.findOne(sequenceId);
  if (!sequence) {
    throw new Error("Sequence not found");
  }
  if (sequence.orgId !== orgId) {
    throw new Error("RLS Isolation Violation: Tenant mismatch.");
  }

  const steps =
    await dbStore.marketingSequenceSteps.findForSequence(sequenceId);
  const stepToDelete = steps.find((s: { id: string }) => s.id === stepId);
  if (!stepToDelete) {
    throw new Error("Step not found");
  }
  for (const s of steps) {
    if (s.orgId !== orgId) {
      throw new Error("RLS Isolation Violation: Tenant mismatch.");
    }
  }

  const deletedNum = stepToDelete.stepNumber;

  // 1. Delete step branches configuration if it exists
  if (dbStore.marketingSequenceStepBranches) {
    const branch =
      await dbStore.marketingSequenceStepBranches.findForStep(stepId);
    if (branch) {
      await dbStore.marketingSequenceStepBranches.delete(branch.id);
    }
  }

  // 2. Delete the step record
  await dbStore.marketingSequenceSteps.delete(stepId);

  // Remaining steps
  const remainingSteps = steps.filter((s: { id: string }) => s.id !== stepId);

  // 3. Shift remaining steps stepNumber and replyToStepNumber
  for (const step of remainingSteps) {
    let updatedStepNumber = step.stepNumber;
    if (step.stepNumber > deletedNum) {
      updatedStepNumber = step.stepNumber - 1;
    }

    let updatedReplyTo = step.replyToStepNumber;
    if (step.replyToStepNumber) {
      if (step.replyToStepNumber === deletedNum) {
        updatedReplyTo = null;
      } else if (step.replyToStepNumber > deletedNum) {
        updatedReplyTo = step.replyToStepNumber - 1;
      }
    }

    await dbStore.marketingSequenceSteps.update(step.id, {
      stepNumber: updatedStepNumber,
      replyToStepNumber: updatedReplyTo || null,
    });
  }

  // 4. Shift branch next step numbers on other steps
  if (dbStore.marketingSequenceStepBranches) {
    for (const step of remainingSteps) {
      const branch = await dbStore.marketingSequenceStepBranches.findForStep(
        step.id,
      );
      if (branch) {
        let updatedTrue = branch.trueNextStepNumber;
        if (branch.trueNextStepNumber) {
          if (branch.trueNextStepNumber === deletedNum) {
            updatedTrue = null;
          } else if (branch.trueNextStepNumber > deletedNum) {
            updatedTrue = branch.trueNextStepNumber - 1;
          }
        }

        let updatedFalse = branch.falseNextStepNumber;
        if (branch.falseNextStepNumber) {
          if (branch.falseNextStepNumber === deletedNum) {
            updatedFalse = null;
          } else if (branch.falseNextStepNumber > deletedNum) {
            updatedFalse = branch.falseNextStepNumber - 1;
          }
        }

        await dbStore.marketingSequenceStepBranches.update(branch.id, {
          trueNextStepNumber: updatedTrue,
          falseNextStepNumber: updatedFalse,
        });
      }
    }
  }

  const updatedSteps =
    await dbStore.marketingSequenceSteps.findForSequence(sequenceId);
  updatedSteps.sort(
    (a: { stepNumber: number }, b: { stepNumber: number }) =>
      a.stepNumber - b.stepNumber,
  );
  return updatedSteps;
}

export async function getMarketingSequenceMemberLogs(
  // biome-ignore lint/suspicious/noExplicitAny: dbStore dynamic reference
  dbStore: any,
  sequenceId: string,
  memberId: string,
  orgId: string,
): Promise<ActivityLogEntry[]> {
  const sequence = await dbStore.marketingSequences.findOne(sequenceId);
  if (!sequence) {
    throw new Error("Sequence not found");
  }
  if (sequence.orgId !== orgId) {
    throw new Error("RLS Isolation Violation: Tenant mismatch.");
  }

  const member = await dbStore.marketingSequenceMemberships.findOne(memberId);
  if (!member) {
    throw new Error("Membership not found");
  }
  if (member.orgId !== orgId) {
    throw new Error("RLS Isolation Violation: Tenant mismatch.");
  }
  if (member.sequenceId !== sequenceId) {
    throw new Error("Membership does not belong to this sequence");
  }

  const trackers = await dbStore.emailTrackers.findMany();
  const memberTrackers = trackers.filter(
    (t: { orgId: string; activityId: string; id: string }) =>
      t.orgId === orgId && t.activityId === memberId,
  );

  if (memberTrackers.length === 0) {
    return [];
  }

  const trackerIds = memberTrackers.map((t: { id: string }) => t.id);

  const [opens, clicks, replies, bounces, readTimes] = await Promise.all([
    dbStore.emailOpenEvents
      .findMany()
      .then((list: EventRecord[]) =>
        list.filter(
          (e) => e.orgId === orgId && trackerIds.includes(e.trackerId),
        ),
      ),
    dbStore.emailClickEvents
      .findMany()
      .then((list: EventRecord[]) =>
        list.filter(
          (e) => e.orgId === orgId && trackerIds.includes(e.trackerId),
        ),
      ),
    dbStore.emailReplyEvents
      .findMany()
      .then((list: EventRecord[]) =>
        list.filter(
          (e) => e.orgId === orgId && trackerIds.includes(e.trackerId),
        ),
      ),
    dbStore.emailBounceEvents
      .findMany()
      .then((list: EventRecord[]) =>
        list.filter(
          (e) => e.orgId === orgId && trackerIds.includes(e.trackerId),
        ),
      ),
    dbStore.emailReadTimeEvents
      .findMany()
      .then((list: EventRecord[]) =>
        list.filter(
          (e) => e.orgId === orgId && trackerIds.includes(e.trackerId),
        ),
      ),
  ]);

  const timeline: ActivityLogEntry[] = [];

  for (const tracker of memberTrackers) {
    timeline.push({
      id: tracker.id,
      type: "sent",
      timestamp: new Date(tracker.createdAt),
      details: {
        token: tracker.token,
        subject: tracker.subject || "",
      },
    });
  }

  for (const open of opens) {
    timeline.push({
      id: open.id,
      type: "open",
      timestamp: new Date(open.createdAt),
      details: {
        ipAddress: open.ipAddress,
        userAgent: open.userAgent,
        deviceType: open.deviceType,
      },
    });
  }

  for (const click of clicks) {
    timeline.push({
      id: click.id,
      type: "click",
      timestamp: new Date(click.createdAt),
      details: {
        clickedUrl: click.clickedUrl,
        ipAddress: click.ipAddress,
        userAgent: click.userAgent,
        utmSource: click.utmSource,
        utmMedium: click.utmMedium,
        utmCampaign: click.utmCampaign,
      },
    });
  }

  for (const reply of replies) {
    timeline.push({
      id: reply.id,
      type: "reply",
      timestamp: new Date(reply.createdAt),
      details: {
        replyBody: reply.replyBody,
        senderEmail: reply.senderEmail,
        sentiment: reply.sentiment,
      },
    });
  }

  for (const bounce of bounces) {
    timeline.push({
      id: bounce.id,
      type: bounce.eventType === "complaint" ? "complaint" : "bounce",
      timestamp: new Date(bounce.createdAt),
      details: {
        bounceType: bounce.bounceType,
        bounceReason: bounce.bounceReason,
      },
    });
  }

  for (const rt of readTimes) {
    timeline.push({
      id: rt.id,
      type: "read_time",
      timestamp: new Date(rt.createdAt),
      details: {
        durationMs: rt.durationMs,
        readClassification: rt.readClassification,
      },
    });
  }

  return timeline.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
}
