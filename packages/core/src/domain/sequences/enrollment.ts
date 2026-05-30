import type {
  CoreExitTrigger,
  CoreSequence,
  CoreSequenceConversion,
  CoreSequenceExclusion,
  CoreSequenceGoal,
  CoreSequenceMembership,
  CoreSequenceStep,
  CoreSequenceSuppression,
} from "../../types";
import { isRecordSuppressedOrExcluded } from "../shared";

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
