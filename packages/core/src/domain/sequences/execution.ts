import type { CoreSequence } from "../../types";
import {
  getNextValidSendingTime,
  isRecordSuppressedOrExcluded,
} from "../shared";
import { evaluateSequenceGoals, shouldExitSequence } from "./enrollment";
import { executeCallStep } from "./execution/call";
import { executeEmailStep } from "./execution/email";
import { executeBranchStep } from "./execution/helpers";
import { executeSmsStep } from "./execution/sms";
import { executeTaskStep } from "./execution/task";
import type { SequenceDbStore } from "./execution/types";
import { executeWebhookStep } from "./execution/webhook";

export { executeCallStep } from "./execution/call";
export { executeEmailStep } from "./execution/email";
export {
  advanceMembershipToNextStep,
  executeBranchStep,
} from "./execution/helpers";
export { executeSmsStep } from "./execution/sms";
export { executeTaskStep } from "./execution/task";
export { SequenceDbStore } from "./execution/types";
export { executeWebhookStep } from "./execution/webhook";

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

    // Track memory telemetry during sequence processing cycles
    try {
      const { MemoryTelemetry } = await import("@crm/observability");
      MemoryTelemetry.check();
    } catch {
      // Safe fallback
    }
  }

  return processedCount;
}
