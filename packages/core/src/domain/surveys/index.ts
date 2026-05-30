import type { SurveyMetricsResult } from "../../types";

export function validateSurveyResponse(
  score: number,
  type: "csat" | "nps",
): { isValid: boolean; error?: string } {
  if (!Number.isInteger(score)) {
    return { isValid: false, error: "Score must be an integer." };
  }
  if (type === "csat") {
    if (score < 1 || score > 5) {
      return { isValid: false, error: "CSAT score must be between 1 and 5." };
    }
  } else if (type === "nps") {
    if (score < 0 || score > 10) {
      return { isValid: false, error: "NPS score must be between 0 and 10." };
    }
  } else {
    return { isValid: false, error: "Invalid survey type." };
  }
  return { isValid: true };
}

export function calculateSurveyMetrics(
  responses: { score: number }[],
  type: "csat" | "nps",
): SurveyMetricsResult {
  const count = responses.length;
  if (count === 0) {
    return {
      count: 0,
      averageScore: "0.00",
      scorePercentage: 0,
    };
  }

  const sum = responses.reduce((acc, curr) => acc + curr.score, 0);
  const averageScore = (sum / count).toFixed(2);

  let scorePercentage = 0;
  if (type === "csat") {
    const satisfied = responses.filter((r) => r.score >= 4).length;
    scorePercentage = Math.round((satisfied / count) * 100 * 100) / 100;
  } else if (type === "nps") {
    const promoters = responses.filter((r) => r.score >= 9).length;
    const detractors = responses.filter((r) => r.score <= 6).length;
    const promoterPct = promoters / count;
    const detractorPct = detractors / count;
    scorePercentage = Math.round((promoterPct - detractorPct) * 100);
  }

  return {
    count,
    averageScore,
    scorePercentage,
  };
}
