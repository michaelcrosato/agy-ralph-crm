import type {
  BounceAnalyticsInput,
  BounceAnalyticsResult,
  BounceTypePerformanceMetric,
  DevicePerformanceMetric,
  OpenAnalyticsInput,
  OpenAnalyticsResult,
  ReadTimeAnalyticsInput,
  ReadTimeAnalyticsResult,
  ReadTimePerformanceMetric,
  ReplyAnalyticsInput,
  ReplyAnalyticsResult,
  SentimentPerformanceMetric,
  StepBounceRateMetric,
  StepOpenRateMetric,
  StepReadTimeStatsMetric,
  StepReplyRateMetric,
  UnsubscribeAnalyticsInput,
  UnsubscribeAnalyticsResult,
} from "../../types";

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
