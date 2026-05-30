import type {
  AgentCSATMetricsInput,
  AgentCSATMetricsResult,
  CompetitorRecord,
  EngagementScoreEventsInput,
  GlobalCompetitorMetrics,
  LinkEngagementInput,
  LinkEngagementResult,
  LinkPerformanceMetric,
  OpportunityRecord,
} from "../../types";

export function calculateGlobalCompetitorAnalytics(params: {
  competitors: CompetitorRecord[];
  opportunities: OpportunityRecord[];
}): GlobalCompetitorMetrics[] {
  const oppMap = new Map<string, OpportunityRecord>();
  for (const opp of params.opportunities) {
    oppMap.set(opp.id, opp);
  }

  const groups = new Map<
    string,
    {
      displayName: string;
      competitors: CompetitorRecord[];
    }
  >();

  for (const comp of params.competitors) {
    const norm = comp.name.trim().toLowerCase();
    if (!norm) continue;
    let grp = groups.get(norm);
    if (!grp) {
      grp = {
        displayName: comp.name.trim(),
        competitors: [],
      };
      groups.set(norm, grp);
    }
    grp.competitors.push(comp);
  }

  const results: GlobalCompetitorMetrics[] = [];

  for (const [_, group] of groups) {
    let wonCount = 0;
    let lostCount = 0;
    let totalValue = 0;
    let wonValue = 0;
    const strengthsSet = new Set<string>();
    const weaknessesSet = new Set<string>();
    const seenOpps = new Set<string>();

    for (const comp of group.competitors) {
      const opp = oppMap.get(comp.opportunityId);
      if (!opp) continue;

      if (!seenOpps.has(opp.id)) {
        seenOpps.add(opp.id);
        const amountVal = Number.parseFloat(opp.amount || "0") || 0;
        totalValue += amountVal;

        if (opp.stage === "Closed Won" && comp.winLossStatus === "Lost") {
          wonCount++;
          wonValue += amountVal;
        } else if (
          opp.stage === "Closed Lost" &&
          comp.winLossStatus === "Won"
        ) {
          lostCount++;
        }
      }

      if (comp.strength?.trim()) {
        strengthsSet.add(comp.strength.trim());
      }
      if (comp.weakness?.trim()) {
        weaknessesSet.add(comp.weakness.trim());
      }
    }

    const totalDecided = wonCount + lostCount;
    const winRate =
      totalDecided > 0
        ? Math.round((wonCount / totalDecided) * 100 * 100) / 100
        : 0.0;

    results.push({
      name: group.displayName,
      totalCompetitions: seenOpps.size,
      wonCount,
      lostCount,
      winRate,
      totalValue: totalValue.toFixed(2),
      wonValue: wonValue.toFixed(2),
      strengths: Array.from(strengthsSet),
      weaknesses: Array.from(weaknessesSet),
    });
  }

  return results;
}

export function calculateAgentCSATMetrics(
  input: AgentCSATMetricsInput,
): AgentCSATMetricsResult {
  const agentTickets = input.tickets.filter(
    (t) => t.assignedToId === input.agentId,
  );
  const totalTickets = agentTickets.length;

  const resolvedOrClosedTickets = agentTickets.filter(
    (t) => t.status === "Resolved" || t.status === "Closed",
  );
  const resolvedTickets = resolvedOrClosedTickets.length;

  // Find all CSAT survey responses linked to this agent's tickets
  const ticketIds = new Set(agentTickets.map((t) => t.id));
  const agentResponses = input.responses.filter(
    (r) => r.ticketId && ticketIds.has(r.ticketId),
  );

  let averageCsat = "0.00";
  let satisfactionRate = 0;

  if (agentResponses.length > 0) {
    const sum = agentResponses.reduce((acc, curr) => acc + curr.score, 0);
    averageCsat = (sum / agentResponses.length).toFixed(2);

    const positiveCount = agentResponses.filter((r) => r.score >= 4).length;
    satisfactionRate =
      Math.round((positiveCount / agentResponses.length) * 100 * 100) / 100;
  }

  // Calculate average resolution time in minutes
  let totalResolutionTimeMs = 0;
  let resolutionTimeCount = 0;

  for (const ticket of resolvedOrClosedTickets) {
    const resolvedAt = ticket.resolvedAt || new Date();
    const durationMs = resolvedAt.getTime() - ticket.createdAt.getTime();
    if (durationMs >= 0) {
      totalResolutionTimeMs += durationMs;
      resolutionTimeCount++;
    }
  }

  const averageResolutionTimeMinutes =
    resolutionTimeCount > 0
      ? Math.round(totalResolutionTimeMs / (1000 * 60) / resolutionTimeCount)
      : 0;

  return {
    totalTickets,
    resolvedTickets,
    averageCsat,
    satisfactionRate,
    averageResolutionTimeMinutes,
  };
}

export function calculateLinkEngagementAnalytics(
  params: LinkEngagementInput,
): LinkEngagementResult {
  const {
    clicks,
    trackers,
    activities,
    activityLinks,
    memberships,
    steps,
    sequenceId,
  } = params;

  const seqMemberships = memberships.filter((m) => m.sequenceId === sequenceId);
  const seqSteps = steps.filter((s) => s.sequenceId === sequenceId);

  const trackerToActivity = new Map<string, string>();
  for (const t of trackers) {
    trackerToActivity.set(t.id, t.activityId);
  }

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

  const performanceMap = new Map<
    string,
    { count: number; stepId: string; stepName: string; clickedUrl: string }
  >();
  let totalTrackedClicks = 0;

  for (const click of clicks) {
    const activityId = trackerToActivity.get(click.trackerId);
    if (activityId) {
      const stepInfo = activityToStep.get(activityId);
      if (stepInfo) {
        const key = `${stepInfo.id}||${click.clickedUrl}`;
        const existing = performanceMap.get(key);
        if (existing) {
          existing.count++;
        } else {
          performanceMap.set(key, {
            count: 1,
            stepId: stepInfo.id,
            stepName: stepInfo.name,
            clickedUrl: click.clickedUrl,
          });
        }
        totalTrackedClicks++;
      }
    }
  }

  const linkPerformance: LinkPerformanceMetric[] = Array.from(
    performanceMap.values(),
  ).map((item) => ({
    clickedUrl: item.clickedUrl,
    stepId: item.stepId,
    stepName: item.stepName,
    clickCount: item.count,
    percentage:
      totalTrackedClicks > 0
        ? `${((item.count / totalTrackedClicks) * 100).toFixed(1)}%`
        : "0.0%",
  }));

  linkPerformance.sort((a, b) => b.clickCount - a.clickCount);

  return {
    totalTrackedClicks,
    linkPerformance,
  };
}

export function calculateRecipientEngagementScore(
  events: EngagementScoreEventsInput,
): number {
  let score = 0;

  // 1. Opens (+1 per event)
  score += events.openCount * 1;

  // 2. Clicks (+3 per event)
  score += events.clickCount * 3;

  // 3. Replies (+10 per event)
  score += events.replyCount * 10;

  // 4. Read times
  for (const event of events.readTimeEvents) {
    if (event.readClassification === "skimmed") {
      score += 2;
    } else if (event.readClassification === "read") {
      score += 5;
    }
  }

  // 5. Bounces & Complaints
  for (const event of events.bounceEvents) {
    if (
      event.eventType === "complaint" ||
      event.bounceType === "spam_complaint"
    ) {
      score -= 10;
    } else if (event.eventType === "bounce") {
      score -= 5;
    }
  }

  // 6. Unsubscribed penalty (-15 points)
  if (events.isUnsubscribed) {
    score -= 15;
  }

  return score;
}
