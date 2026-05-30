import type { SequenceAnalyticsResult, StepAnalytics } from "../../types";

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
