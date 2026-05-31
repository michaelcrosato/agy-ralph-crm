export type BANTValue = "qualified" | "unqualified" | "unknown";

export interface BANTProfile {
  bantBudget: BANTValue;
  bantAuthority: BANTValue;
  bantNeed: BANTValue;
  bantTimeline: BANTValue;
  bantScore: number;
  botQualificationStatus: "qualified" | "unqualified" | "needs_more_info";
  botNextQuery: string | null;
  botNotes: string;
}

/**
 * Evaluates the linked conversation history to construct a full BANT profile.
 * Standardizing BANT = Budget, Authority, Need, Timeline.
 */
export function evaluateBantState(
  history: { type: string; subject: string; body: string | null }[],
): BANTProfile {
  let bantBudget: BANTValue = "unknown";
  let bantAuthority: BANTValue = "unknown";
  let bantNeed: BANTValue = "unknown";
  let bantTimeline: BANTValue = "unknown";

  const notes: string[] = [];

  // Concatenate all inbound activities to evaluate semantics
  const textToScan = history
    .map((act) => `${act.subject || ""} ${act.body || ""}`)
    .join(" ")
    .toLowerCase();

  // If no history exists, return initial defaults
  if (history.length === 0) {
    return {
      bantBudget,
      bantAuthority,
      bantNeed,
      bantTimeline,
      bantScore: 0,
      botQualificationStatus: "needs_more_info",
      botNextQuery:
        "Hi there! Thank you for reaching out. What is your primary timeline and estimated team size for this deployment?",
      botNotes: "No conversation history found. Bot initialized.",
    };
  }

  // 1. Evaluate BUDGET
  // Qualify: Dollar amount or "budget", "funding", "pricing", "k"
  const hasMoneyPattern =
    /\$\d+,?\d*k?/i.test(textToScan) || /\b\d+k\b/i.test(textToScan);
  const budgetKeywords = [
    "budget is",
    "have budget",
    "funding",
    "investing",
    "allocated",
  ];
  const matchesBudgetPositive =
    budgetKeywords.some((kw) => textToScan.includes(kw)) || hasMoneyPattern;

  const budgetNegative = [
    "no budget",
    "free tier",
    "zero budget",
    "cannot pay",
    "broke",
    "too expensive",
  ];
  const matchesBudgetNegative = budgetNegative.some((kw) =>
    textToScan.includes(kw),
  );

  if (matchesBudgetNegative) {
    bantBudget = "unqualified";
    notes.push("Expressed explicit budget limitations.");
  } else if (matchesBudgetPositive) {
    bantBudget = "qualified";
    notes.push("Budget validated successfully.");
  }

  // 2. Evaluate AUTHORITY
  // Qualify: professional roles / decision makers
  const authorityKeywords = [
    "ceo",
    "cto",
    "cio",
    "cfo",
    "vp",
    "founder",
    "director",
    "manager",
    "decision maker",
    "authorized",
    "owner",
    "partner",
  ];
  const matchesAuthorityPositive = authorityKeywords.some((kw) => {
    const regex = new RegExp(`\\b${kw}\\b`, "i");
    return regex.test(textToScan);
  });

  const authorityNegative = [
    "intern",
    "student",
    "junior",
    "assistant",
    "no say",
    "not decision maker",
  ];
  const matchesAuthorityNegative = authorityNegative.some((kw) =>
    textToScan.includes(kw),
  );

  if (matchesAuthorityNegative) {
    bantAuthority = "unqualified";
    notes.push("Identified as non-decision maker.");
  } else if (matchesAuthorityPositive) {
    bantAuthority = "qualified";
    notes.push("Decision authority confirmed.");
  }

  // 3. Evaluate NEED
  // Qualify: CRM pain points or value drivers
  const needKeywords = [
    "crm",
    "sequences",
    "leads",
    "pipeline",
    "sales",
    "automation",
    "workflow",
    "security",
    "integration",
    "multi-tenant",
    "contacts",
    "opportunities",
  ];
  const matchesNeedPositive = needKeywords.some((kw) =>
    textToScan.includes(kw),
  );

  const needNegative = [
    "no need",
    "accident",
    "not interested",
    "wrong number",
    "uninterested",
  ];
  const matchesNeedNegative = needNegative.some((kw) =>
    textToScan.includes(kw),
  );

  if (matchesNeedNegative) {
    bantNeed = "unqualified";
    notes.push("Indicated no active relational need.");
  } else if (matchesNeedPositive) {
    bantNeed = "qualified";
    notes.push("relational value need identified.");
  }

  // 4. Evaluate TIMELINE
  // Qualify: conversion windows
  const timelineKeywords = [
    "asap",
    "immediate",
    "now",
    "this month",
    "3 months",
    "soon",
    "quarter",
    "weeks",
  ];
  const matchesTimelinePositive = timelineKeywords.some((kw) =>
    textToScan.includes(kw),
  );

  const timelineNegative = [
    "next year",
    "no rush",
    "someday",
    "just browsing",
    "future reference",
  ];
  const matchesTimelineNegative = timelineNegative.some((kw) =>
    textToScan.includes(kw),
  );

  if (matchesTimelineNegative) {
    bantTimeline = "unqualified";
    notes.push("Timeline deferred indefinitely.");
  } else if (matchesTimelinePositive) {
    bantTimeline = "qualified";
    notes.push("Purchase timeline qualified.");
  }

  // 5. Calculate BANT Score
  let bantScore = 0;
  if (bantBudget === "qualified") bantScore += 25;
  if (bantAuthority === "qualified") bantScore += 25;
  if (bantNeed === "qualified") bantScore += 25;
  if (bantTimeline === "qualified") bantScore += 25;

  // Determine Bot Qualification Status
  let botQualificationStatus: "qualified" | "unqualified" | "needs_more_info" =
    "needs_more_info";
  let botNextQuery: string | null = null;

  const isCriticalBlocker =
    bantBudget === "unqualified" || bantNeed === "unqualified";

  if (isCriticalBlocker) {
    botQualificationStatus = "unqualified";
    botNextQuery =
      "Thank you for sharing your feedback. Based on your current setup, it seems we might not be the best fit at this moment. We'll keep you in mind for future updates!";
  } else if (bantScore >= 100) {
    botQualificationStatus = "qualified";
    botNextQuery =
      "Excellent news! Based on our chat, you qualify for a premium sandbox environment. A product specialist will be in touch shortly to configure your instance.";
  } else {
    botQualificationStatus = "needs_more_info";
    // Prompt for the first unknown BANT property
    if (bantBudget === "unknown") {
      botNextQuery =
        "Could you tell me a little bit about your planned budget range for a CRM implementation?";
    } else if (bantAuthority === "unknown") {
      botNextQuery =
        "Are you the primary decision-maker for this CRM evaluation, or should we align with someone else?";
    } else if (bantNeed === "unknown") {
      botNextQuery =
        "What are the core pain points or workflows your team is hoping to optimize using our CRM?";
    } else if (bantTimeline === "unknown") {
      botNextQuery =
        "What is your target timeline for adopting and going live with a new platform?";
    }
  }

  return {
    bantBudget,
    bantAuthority,
    bantNeed,
    bantTimeline,
    bantScore,
    botQualificationStatus,
    botNextQuery,
    botNotes:
      notes.join(" ") ||
      "Bot evaluation completed. No key matching cues resolved.",
  };
}
