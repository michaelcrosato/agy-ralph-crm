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
} from "../../../types";

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
